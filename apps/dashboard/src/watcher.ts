/**
 * @fileoverview FSEvents Watcher + Notification Engine
 *
 * Monitors ~/.claude/projects/ for JSONL changes using native fs.watch (FSEvents on macOS).
 * Fires macOS notifications and optional Slack webhooks when thresholds are crossed.
 * Zero external dependencies — uses only Node.js built-ins + osascript.
 */

import { watch, existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

type WatcherConfig = {
	claudePath: string;
	monthlyLimit: number;
	warningPercent: number;
	criticalPercent: number;
	slackWebhookUrl: string | null;
	configPath: string;
};

type WatcherState = {
	lastCost: number;
	lastAlertLevel: string;
	lastNotifiedAt: number;
	listeners: Set<(event: WatcherEvent) => void>;
};

type WatcherEvent = {
	type: 'cost_update' | 'alert' | 'file_change';
	data: Record<string, unknown>;
	timestamp: string;
};

const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between notifications

const state: WatcherState = {
	lastCost: 0,
	lastAlertLevel: 'normal',
	lastNotifiedAt: 0,
	listeners: new Set(),
};

let config: WatcherConfig;

/**
 * Load persisted config from disk
 */
function loadConfig(configPath: string): Partial<WatcherConfig> {
	try {
		if (existsSync(configPath)) {
			return JSON.parse(readFileSync(configPath, 'utf-8'));
		}
	} catch {
		/* ignore */
	}
	return {};
}

/**
 * Save config to disk
 */
export function saveConfig(updates: Partial<WatcherConfig>): void {
	if (!config) return;
	Object.assign(config, updates);
	try {
		const persist = {
			monthlyLimit: config.monthlyLimit,
			warningPercent: config.warningPercent,
			criticalPercent: config.criticalPercent,
			slackWebhookUrl: config.slackWebhookUrl,
		};
		writeFileSync(config.configPath, JSON.stringify(persist, null, 2));
	} catch {
		/* ignore */
	}
}

/**
 * Send macOS native notification via osascript (zero deps)
 */
function sendMacNotification(title: string, message: string, sound = 'Basso'): void {
	const script = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}" sound name "${sound}"`;
	execFile('osascript', ['-e', script], (err) => {
		if (err) process.stderr.write(`[watcher] notification error: ${err.message}\n`);
	});
}

/**
 * Send Slack webhook (zero deps — uses native fetch)
 */
async function sendSlackAlert(
	webhookUrl: string,
	level: string,
	cost: number,
	limit: number,
): Promise<void> {
	const emoji = level === 'critical' ? '🚨' : '⚠️';
	const pct = limit > 0 ? ((cost / limit) * 100).toFixed(1) : '∞';
	const payload = {
		text: `${emoji} *Token Guard Alert* — ${level.toUpperCase()}\nGasto mensal: *$${cost.toFixed(2)}* (${pct}% do limite de $${limit})\nMáquina: ${process.env.USER ?? 'unknown'}@${require('os').hostname()}`,
	};
	try {
		await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
	} catch (err) {
		process.stderr.write(`[watcher] slack error: ${(err as Error).message}\n`);
	}
}

/**
 * Emit event to all SSE listeners
 */
function emit(event: WatcherEvent): void {
	for (const listener of state.listeners) {
		try {
			listener(event);
		} catch {
			/* ignore */
		}
	}
}

/**
 * Subscribe to watcher events (for SSE)
 */
export function subscribe(listener: (event: WatcherEvent) => void): () => void {
	state.listeners.add(listener);
	return () => state.listeners.delete(listener);
}

/**
 * Check thresholds and fire alerts
 */
function checkThresholds(currentMonthCost: number): void {
	const { monthlyLimit, warningPercent, criticalPercent } = config;
	const pct = monthlyLimit > 0 ? (currentMonthCost / monthlyLimit) * 100 : 0;

	let alertLevel = 'normal';
	if (pct >= criticalPercent) alertLevel = 'critical';
	else if (pct >= warningPercent) alertLevel = 'warning';

	const now = Date.now();
	const shouldNotify =
		alertLevel !== 'normal' &&
		alertLevel !== state.lastAlertLevel &&
		now - state.lastNotifiedAt > NOTIFY_COOLDOWN_MS;

	if (shouldNotify) {
		const title =
			alertLevel === 'critical' ? 'ALERTA CRÍTICO — Token Guard' : 'Atenção — Token Guard';
		const msg = `Gasto mensal: $${currentMonthCost.toFixed(2)} (${pct.toFixed(0)}% do limite de $${monthlyLimit})`;

		// macOS notification
		sendMacNotification(title, msg, alertLevel === 'critical' ? 'Sosumi' : 'Basso');

		// Slack webhook (if configured)
		if (config.slackWebhookUrl) {
			sendSlackAlert(config.slackWebhookUrl, alertLevel, currentMonthCost, monthlyLimit);
		}

		state.lastNotifiedAt = now;

		emit({
			type: 'alert',
			data: { alertLevel, cost: currentMonthCost, pct, limit: monthlyLimit },
			timestamp: new Date().toISOString(),
		});
	}

	state.lastAlertLevel = alertLevel;
	state.lastCost = currentMonthCost;
}

/**
 * Quick parse a JSONL file and sum costs for current month
 */
function parseMonthCostFromFile(filePath: string, currentMonth: string): number {
	try {
		const content = readFileSync(filePath, 'utf-8');
		let cost = 0;
		for (const line of content.split('\n')) {
			if (!line.trim()) continue;
			try {
				const entry = JSON.parse(line);
				if (entry.timestamp && entry.timestamp.startsWith(currentMonth)) {
					cost += entry.costUSD ?? 0;
				}
			} catch {
				/* skip malformed lines */
			}
		}
		return cost;
	} catch {
		return 0;
	}
}

/**
 * Scan all JSONL files and compute current month cost
 */
function computeCurrentMonthCost(claudePath: string): number {
	const projectsDir = path.join(claudePath, 'projects');
	if (!existsSync(projectsDir)) return 0;

	const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
	let totalCost = 0;

	try {
		for (const project of readdirSync(projectsDir)) {
			const projDir = path.join(projectsDir, project);
			if (!statSync(projDir).isDirectory()) continue;
			for (const file of readdirSync(projDir)) {
				if (file.endsWith('.jsonl')) {
					totalCost += parseMonthCostFromFile(path.join(projDir, file), currentMonth);
				}
			}
		}
	} catch {
		/* ignore */
	}

	return totalCost;
}

/**
 * Start the FSEvents watcher daemon
 */
export function startWatcher(opts: { claudePath: string; configPath: string }): void {
	const savedConfig = loadConfig(opts.configPath);
	config = {
		claudePath: opts.claudePath,
		monthlyLimit: savedConfig.monthlyLimit ?? 500,
		warningPercent: savedConfig.warningPercent ?? 80,
		criticalPercent: savedConfig.criticalPercent ?? 95,
		slackWebhookUrl: savedConfig.slackWebhookUrl ?? null,
		configPath: opts.configPath,
	};

	const projectsDir = path.join(opts.claudePath, 'projects');
	if (!existsSync(projectsDir)) {
		process.stderr.write(`[watcher] projects dir not found: ${projectsDir}\n`);
		return;
	}

	// Initial cost calculation
	const initialCost = computeCurrentMonthCost(opts.claudePath);
	state.lastCost = initialCost;
	process.stderr.write(`[watcher] started — monitoring ${projectsDir}\n`);
	process.stderr.write(`[watcher] current month cost: $${initialCost.toFixed(2)}\n`);
	checkThresholds(initialCost);

	// Watch for changes (FSEvents on macOS)
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	watch(projectsDir, { recursive: true }, (_eventType, filename) => {
		if (!filename || !filename.endsWith('.jsonl')) return;

		// Debounce: Claude writes multiple lines rapidly
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const cost = computeCurrentMonthCost(opts.claudePath);

			if (Math.abs(cost - state.lastCost) > 0.001) {
				emit({
					type: 'cost_update',
					data: { previousCost: state.lastCost, currentCost: cost, delta: cost - state.lastCost },
					timestamp: new Date().toISOString(),
				});
				checkThresholds(cost);
			}

			emit({
				type: 'file_change',
				data: { file: filename },
				timestamp: new Date().toISOString(),
			});
		}, 500);
	});
}

/**
 * Get current watcher state
 */
export function getWatcherState(): {
	cost: number;
	alertLevel: string;
	config: Omit<WatcherConfig, 'configPath'>;
} {
	return {
		cost: state.lastCost,
		alertLevel: state.lastAlertLevel,
		config: {
			claudePath: config?.claudePath ?? '',
			monthlyLimit: config?.monthlyLimit ?? 500,
			warningPercent: config?.warningPercent ?? 80,
			criticalPercent: config?.criticalPercent ?? 95,
			slackWebhookUrl: config?.slackWebhookUrl ?? null,
		},
	};
}
