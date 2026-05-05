#!/usr/bin/env -S npx tsx

/**
 * @fileoverview Entry point for Token Guard Dashboard
 *
 * Starts a local HTTP server that serves the FinOps dashboard
 * for monitoring Claude Code token usage and costs.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createDashboardApp } from './server.ts';
import { startWatcher } from './watcher.ts';
import open from 'open';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;
const port = Number(process.env.PORT ?? DEFAULT_PORT);

// Find monorepo root (where node_modules/.bin/bun lives)
const monorepoRoot = path.resolve(__dirname, '../../..');
const bunBin = path.join(monorepoRoot, 'node_modules', '.bin', 'bun');
if (!existsSync(bunBin)) {
	process.stderr.write(`Error: Cannot find bun at ${bunBin}\n`);
	process.stderr.write(`Run 'pnpm install' in the monorepo root first.\n`);
	process.exit(1);
}

// Find ccusage entry point
const ccusageBin = path.resolve(__dirname, '../../ccusage/src/index.ts');
if (!existsSync(ccusageBin)) {
	process.stderr.write(`Error: Cannot find ccusage at ${ccusageBin}\n`);
	process.exit(1);
}

// Detect Claude config path
const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
const claudePaths = [path.join(home, '.config', 'claude'), path.join(home, '.claude')];
const claudePath = claudePaths.find((p) => {
	try {
		return existsSync(path.join(p, 'projects'));
	} catch {
		return false;
	}
});

if (!claudePath) {
	process.stderr.write('Error: No valid Claude data directory found.\n');
	process.exit(1);
}

const configPath = path.join(__dirname, '.token-guard-config.json');
const app = createDashboardApp({ claudePath, ccusageBin, bunBin });

// Start FSEvents watcher daemon (zero CPU when idle)
startWatcher({ claudePath, configPath });

serve({ fetch: app.fetch, port }, (info) => {
	const url = `http://localhost:${info.port}`;
	process.stderr.write(`\n  🛡️  Token Guard Dashboard\n`);
	process.stderr.write(`  ────────────────────────────────\n`);
	process.stderr.write(`  Dashboard: ${url}\n`);
	process.stderr.write(`  Claude:    ${claudePath}\n`);
	process.stderr.write(`  Watcher:   FSEvents (active)\n`);
	process.stderr.write(`  Config:    ${configPath}\n`);
	process.stderr.write(`  ────────────────────────────────\n\n`);

	open(url).catch(() => {});
});
