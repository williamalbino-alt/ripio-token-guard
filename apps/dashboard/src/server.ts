/**
 * @fileoverview Hono server for the Token Guard Dashboard
 *
 * Provides REST API endpoints that invoke ccusage CLI with --json
 * and serves the static dashboard HTML. Runs 100% offline.
 *
 * @module server
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { subscribe, getWatcherState, saveConfig } from './watcher.ts';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Recursively calculate the total size of a directory in bytes
 */
function getDirSizeBytes(dirPath: string): number {
	try {
		let total = 0;
		const entries = readdirSync(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			const full = path.join(dirPath, entry.name);
			if (entry.isDirectory()) {
				total += getDirSizeBytes(full);
			} else if (entry.isFile()) {
				try {
					total += statSync(full).size;
				} catch {
					/* skip */
				}
			}
		}
		return total;
	} catch {
		return 0;
	}
}

/**
 * In-memory threshold configuration
 */
let thresholdConfig = {
	monthlyLimit: 500,
	warningPercent: 80,
	criticalPercent: 95,
	projectLimits: {} as Record<string, number>,
};

type DashboardOptions = {
	claudePath: string;
	ccusageBin: string;
	bunBin: string;
};

/**
 * Run ccusage CLI and return parsed JSON
 */
async function runCcusage(
	opts: DashboardOptions,
	command: string,
	extraArgs: string[] = [],
): Promise<unknown> {
	const { exec } = await import('node:child_process');
	const { promisify } = await import('node:util');
	const { readFileSync, unlinkSync } = await import('node:fs');
	const execAsync = promisify(exec);

	const tmpFile = `/tmp/ccusage_${Date.now()}_${Math.random().toString(36).slice(2)}.json`;
	const argsStr = extraArgs.join(' ');
	const env = { ...process.env, CLAUDE_CONFIG_DIR: opts.claudePath, LOG_LEVEL: '0' };

	try {
		await execAsync(
			`"${opts.bunBin}" "${opts.ccusageBin}" ${command} --json ${argsStr} > "${tmpFile}"`,
			{
				env,
				maxBuffer: 50 * 1024 * 1024,
			},
		);
		const data = readFileSync(tmpFile, 'utf8');
		try {
			unlinkSync(tmpFile);
		} catch (e) {}
		return JSON.parse(data);
	} catch (err) {
		console.error(`runCcusage error for command ${command}:`, err);
		try {
			unlinkSync(tmpFile);
		} catch (e) {}
		return null;
	}
}

export function createDashboardApp(opts: DashboardOptions): Hono {
	const app = new Hono();
	app.use('*', cors());

	// ─── API: Daily Usage ───────────────────────────────────
	app.get('/api/daily', async (c) => {
		const since = c.req.query('since');
		const until = c.req.query('until');
		const extra: string[] = [];
		if (since) extra.push('--since', since);
		if (until) extra.push('--until', until);
		const data = await runCcusage(opts, 'daily', extra);
		return c.json(data ?? { daily: [], totals: {} });
	});

	// ─── API: Monthly Usage ─────────────────────────────────
	app.get('/api/monthly', async (c) => {
		const since = c.req.query('since');
		const until = c.req.query('until');
		const extra: string[] = [];
		if (since) extra.push('--since', since);
		if (until) extra.push('--until', until);
		const data = await runCcusage(opts, 'monthly', extra);
		return c.json(data ?? { monthly: [], totals: {} });
	});

	// ─── API: Session Usage ─────────────────────────────────
	app.get('/api/sessions', async (c) => {
		const data = await runCcusage(opts, 'session');
		return c.json(data ?? { sessions: [], totals: {} });
	});

	// ─── API: Summary (Overview) ────────────────────────────
	app.get('/api/summary', async (c) => {
		const dailyRaw = (await runCcusage(opts, 'daily')) as any;
		const monthlyRaw = (await runCcusage(opts, 'monthly')) as any;

		const dailyData = dailyRaw?.daily ?? [];
		const monthlyData = monthlyRaw?.monthly ?? [];
		const totals = dailyRaw?.totals ?? { totalCost: 0 };

		// Use local timezone for date matching (UTC can be 1 day ahead in BR timezone)
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const todayData = dailyData.find((d: any) => d.date === today);

		const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		const currentMonthData = monthlyData.find((d: any) => d.month === currentMonth);
		const currentMonthCost = currentMonthData?.totalCost ?? 0;

		const dayOfMonth = new Date().getDate();
		const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
		const projectedMonthlyCost = dayOfMonth > 0 ? (currentMonthCost / dayOfMonth) * daysInMonth : 0;

		// Model breakdown aggregation
		const modelCosts = new Map<string, number>();
		const modelTokens = new Map<string, number>();
		const allModels = new Set<string>();
		for (const d of dailyData) {
			for (const m of d.modelsUsed ?? []) allModels.add(m);
			for (const b of d.modelBreakdowns ?? []) {
				modelCosts.set(b.modelName, (modelCosts.get(b.modelName) ?? 0) + b.cost);
				modelTokens.set(
					b.modelName,
					(modelTokens.get(b.modelName) ?? 0) +
						(b.inputTokens ?? 0) +
						(b.outputTokens ?? 0) +
						(b.cacheCreationTokens ?? 0) +
						(b.cacheReadTokens ?? 0),
				);
			}
		}

		const modelBreakdown = Array.from(modelCosts.entries())
			.map(([model, cost]) => ({ model, cost, tokens: modelTokens.get(model) ?? 0 }))
			.sort((a, b) => b.cost - a.cost);

		// Threshold status
		const { monthlyLimit, warningPercent, criticalPercent } = thresholdConfig;
		const usagePercent = monthlyLimit > 0 ? (currentMonthCost / monthlyLimit) * 100 : 0;
		let alertLevel = 'normal';
		if (usagePercent >= criticalPercent) alertLevel = 'critical';
		else if (usagePercent >= warningPercent) alertLevel = 'warning';

		// Top project: match session paths against actual Claude projects directories
		let topProject = { name: 'N/A', cost: 0 };
		const sessionRaw = (await runCcusage(opts, 'session')) as any;
		const sessions = sessionRaw?.sessions ?? [];

		// Build a mapping from encoded dir name to real project basename
		// Claude encodes project paths as dir names: /Users/ripio/Documents/Ideas Ripio/cx-assigment
		// becomes: -Users-ripio-Documents-Ideas-Ripio-cx-assigment (spaces → dashes, slashes → dashes)
		// Strategy: find workspace roots on disk, encode them the same way, and strip as prefix
		const projectsDir = path.join(opts.claudePath, 'projects');
		const dirToProject = new Map<string, string>();
		try {
			const { readdirSync, existsSync: existsDir, statSync } = await import('node:fs');
			const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
			if (existsDir(projectsDir)) {
				const encodedDirs = readdirSync(projectsDir).filter((d: string) => d.startsWith('-'));

				// Discover workspace roots by finding parent dirs that contain multiple projects
				// Build common prefixes from the encoded dir names
				for (const dir of encodedDirs) {
					const parts = dir.split('-').filter(Boolean); // remove empty strings
					const len = parts.length;
					let projectName = dir;

					if (len > 0) {
						// If the second to last part is 'apps' or 'packages', take 3 segments
						if (len >= 3 && (parts[len - 2] === 'apps' || parts[len - 2] === 'packages')) {
							projectName = parts.slice(len - 3).join('/');
						}
						// Otherwise take 2 segments
						else if (len >= 2) {
							projectName = parts.slice(len - 2).join('/');
						}
						// Fallback to last segment
						else {
							projectName = parts[len - 1];
						}
					}

					dirToProject.set(dir, projectName);
				}
			}
		} catch {
			/* dir may not exist */
		}

		const sessProjMap = new Map<string, number>();
		for (const s of sessions) {
			const projPath: string = s.projectPath ?? 'unknown';

			if (projPath === 'Unknown Project' || projPath === 'unknown') {
				// Flag: potential API/MCP/extension token usage (no project dir)
				sessProjMap.set(
					'⚠ API / MCP / Extensões',
					(sessProjMap.get('⚠ API / MCP / Extensões') ?? 0) + (s.totalCost ?? 0),
				);
				continue;
			}

			// Extract the project directory part (before the /sessionId)
			const dirPart = projPath.split('/')[0];

			// Look up in our filesystem-verified mapping
			const projectName = dirToProject.get(dirPart) ?? dirPart;
			sessProjMap.set(projectName, (sessProjMap.get(projectName) ?? 0) + (s.totalCost ?? 0));
		}
		const sortedProjects = Array.from(sessProjMap.entries()).sort((a, b) => b[1] - a[1]);
		if (sortedProjects.length > 0)
			topProject = { name: sortedProjects[0][0], cost: sortedProjects[0][1] };
		const secondProject =
			sortedProjects.length > 1 ? { name: sortedProjects[1][0], cost: sortedProjects[1][1] } : null;
		// Include all projects for the overview
		const allProjects = sortedProjects.map(([name, cost]) => ({ name, cost }));

		// Calculate log directory size
		const logSizeBytes = getDirSizeBytes(path.join(opts.claudePath, 'projects'));

		return c.json({
			totalCost: totals.totalCost ?? 0,
			todayCost: todayData?.totalCost ?? 0,
			currentMonthCost,
			projectedMonthlyCost,
			totalDays: dailyData.length,
			totalModels: allModels.size,
			modelBreakdown,
			topProject,
			secondProject,
			allProjects,
			logSizeBytes,
			threshold: {
				monthlyLimit,
				usagePercent,
				alertLevel,
				remaining: Math.max(0, monthlyLimit - currentMonthCost),
			},
			lastUpdated: new Date().toISOString(),
		});
	});

	// ─── API: Thresholds ────────────────────────────────────
	app.get('/api/thresholds', (c) => c.json(thresholdConfig));

	app.post('/api/thresholds', async (c) => {
		const body = (await c.req.json()) as Partial<typeof thresholdConfig>;
		thresholdConfig = { ...thresholdConfig, ...body };
		// Sync with watcher
		saveConfig({
			monthlyLimit: thresholdConfig.monthlyLimit,
			warningPercent: thresholdConfig.warningPercent,
			criticalPercent: thresholdConfig.criticalPercent,
		});
		return c.json({ success: true, config: thresholdConfig });
	});

	// ─── API: Insights / Resumo Inteligente ─────────────────
	app.get('/api/insights', async (c) => {
		const lang = (c.req.query('lang') || 'es') as 'es' | 'pt';
		const L = (es: string, pt: string) => (lang === 'pt' ? pt : es);
		const dailyRaw = (await runCcusage(opts, 'daily')) as any;
		const dailyData = dailyRaw?.daily ?? [];
		const totals = dailyRaw?.totals ?? {
			totalCost: 0,
			inputTokens: 0,
			outputTokens: 0,
			cacheCreationTokens: 0,
			cacheReadTokens: 0,
		};
		if (dailyData.length === 0) return c.json({ error: 'no data' });

		// Model aggregation
		const modelCosts = new Map<
			string,
			{ cost: number; input: number; output: number; cacheCreate: number; cacheRead: number }
		>();
		for (const d of dailyData) {
			for (const b of d.modelBreakdowns ?? []) {
				const existing = modelCosts.get(b.modelName) ?? {
					cost: 0,
					input: 0,
					output: 0,
					cacheCreate: 0,
					cacheRead: 0,
				};
				existing.cost += b.cost;
				existing.input += b.inputTokens ?? 0;
				existing.output += b.outputTokens ?? 0;
				existing.cacheCreate += b.cacheCreationTokens ?? 0;
				existing.cacheRead += b.cacheReadTokens ?? 0;
				modelCosts.set(b.modelName, existing);
			}
		}
		const sortedModels = Array.from(modelCosts.entries()).sort((a, b) => b[1].cost - a[1].cost);
		const topModelName = sortedModels[0]?.[0] ?? 'unknown';
		const topModelCost = sortedModels[0]?.[1]?.cost ?? 0;
		const opusPct = totals.totalCost > 0 ? (topModelCost / totals.totalCost) * 100 : 0;
		const avgDaily = totals.totalCost / Math.max(dailyData.length, 1);

		// Cache analysis
		const totalCacheCreate = totals.cacheCreationTokens ?? 0;
		const totalCacheRead = totals.cacheReadTokens ?? 0;
		const totalInput = totals.inputTokens ?? 0;
		const totalOutput = totals.outputTokens ?? 0;

		// Find Sonnet cost if exists
		const sonnetEntry = sortedModels.find(([name]) => name.includes('sonnet'));
		const opusEntry = sortedModels.find(([name]) => name.includes('opus'));
		const opusCost = opusEntry?.[1]?.cost ?? 0;

		// Estimate savings: if all opus usage switched to sonnet (sonnet is ~5x cheaper)
		const savingIfSwitchToSonnet = opusCost * 0.8; // Sonnet is ~80% cheaper
		const savingIfReduceContext =
			totalCacheCreate > 0
				? (totalCacheCreate / (totalInput + totalCacheCreate + totalCacheRead)) *
					totals.totalCost *
					0.3
				: 0;
		const potentialSaving = savingIfSwitchToSonnet * 0.5 + savingIfReduceContext; // conservative: only 50% of opus could switch

		// Diagnosis text
		const isOpusHeavy = topModelName.includes('opus') && opusPct > 40;
		const highCacheCreate = totalCacheCreate > totalInput * 2;
		const shortModel = (m: string) => m.replace('claude-', '').replace(/-2025\d*/, '');

		let diagnosis = L(
			`En los últimos ${dailyData.length} días, se gastaron $${totals.totalCost.toFixed(2)} en tokens. El promedio diario es de $${avgDaily.toFixed(2)}. `,
			`Nos últimos ${dailyData.length} dias, foram gastos $${totals.totalCost.toFixed(2)} em tokens. A média diária é de $${avgDaily.toFixed(2)}. `,
		);
		if (isOpusHeavy) {
			diagnosis += L(
				`El principal problema es la concentración del ${opusPct.toFixed(0)}% de los costos en el modelo ${shortModel(topModelName)}, el modelo más caro de Anthropic. Cada token de input en Opus cuesta $15/MTok vs $3/MTok en Sonnet — una diferencia de 5x. `,
				`O principal problema é a concentração de ${opusPct.toFixed(0)}% dos custos no modelo ${shortModel(topModelName)}, que é o modelo mais caro da Anthropic. Cada token de input no Opus custa $15/MTok vs $3/MTok no Sonnet — uma diferença de 5x. `,
			);
		}
		if (highCacheCreate) {
			diagnosis += L(
				`Hay un volumen alto de "Cache Creation Tokens" (${(totalCacheCreate / 1e6).toFixed(1)}M), lo que significa que el contexto de las conversaciones se está recreando frecuentemente. Esto sucede cuando conversaciones largas se reinician o cuando el CLAUDE.md/contexto cambia mucho entre sesiones. `,
				`Há um volume alto de "Cache Creation Tokens" (${(totalCacheCreate / 1e6).toFixed(1)}M), o que significa que o contexto das conversas está sendo recriado frequentemente. Isso acontece quando conversas longas são reiniciadas ou quando o sistema CLAUDE.md/contexto muda muito entre sessões. `,
			);
		}

		// Build actions
		const actions = [];

		if (isOpusHeavy) {
			actions.push({
				title: L(
					'Usar Sonnet en vez de Opus para tareas rutinarias',
					'Usar Sonnet em vez de Opus para tarefas rotineiras',
				),
				description: L(
					`El modelo ${shortModel(topModelName)} representa el ${opusPct.toFixed(0)}% de sus costos ($${opusCost.toFixed(2)}). Sonnet 4 es 5x más barato y en muchos escenarios de código tiene calidad comparable. Opus debe reservarse solo para tareas que exigen razonamiento profundo.`,
					`O modelo ${shortModel(topModelName)} representa ${opusPct.toFixed(0)}% dos seus custos ($${opusCost.toFixed(2)}). Sonnet 4 é 5x mais barato e em muitos cenários de código tem qualidade comparable. Opus deve ser reservado apenas para tarefas que exigem raciocínio profundo.`,
				),
				saving: `~$${(savingIfSwitchToSonnet * 0.5).toFixed(0)}/${L('mes', 'mês')}`,
				steps: [
					L(
						'En Claude Code, use /model para cambiar a Sonnet antes de tareas simples (formateo, tests, docs)',
						'No Claude Code, use /model para trocar para Sonnet antes de tarefas simples (formatação, testes, docs)',
					),
					L(
						'Reserve Opus solo para: debugging complejo, diseño de arquitectura y refactoring a gran escala',
						'Reserve Opus apenas para: debugging complexo, design de arquitetura, e refactoring de grande escala',
					),
					L(
						'Configure el modelo predeterminado como Sonnet en su .claude/settings.json',
						'Configure o modelo padrão como Sonnet no seu .claude/settings.json',
					),
				],
				risks: L(
					'Sonnet puede generar respuestas menos precisas en tareas de razonamiento profundo. Para código crítico de producción, mantenga Opus. Para el 80% de las tareas diarias, Sonnet es suficiente.',
					'Sonnet pode gerar respostas menos precisas em tarefas de raciocínio profundo. Para código crítico de produção, mantenha Opus. Para 80% das tarefas diárias, Sonnet é suficiente.',
				),
			});
		}

		if (highCacheCreate) {
			actions.push({
				title: L(
					'Reducir el contexto de las conversaciones para disminuir Cache Creation',
					'Reduzir o contexto das conversas para diminuir Cache Creation',
				),
				description: L(
					`Tiene ${(totalCacheCreate / 1e6).toFixed(1)}M tokens gastados en "Cache Creation" — esto es el costo de enviar el contexto completo al iniciar o reiniciar conversaciones. Cada vez que el contexto cambia significativamente, el cache se recrea desde cero.`,
					`Você tem ${(totalCacheCreate / 1e6).toFixed(1)}M tokens gastos em "Cache Creation" — isso é o custo de enviar o contexto completo ao iniciar ou reiniciar conversas. Cada vez que o contexto muda significativamente, o cache é recriado do zero.`,
				),
				saving: `~$${savingIfReduceContext.toFixed(0)}/${L('mes', 'mês')}`,
				steps: [
					L(
						'Evite reiniciar conversaciones (cada /clear o nueva sesión recrea el cache entero)',
						'Evite reiniciar conversas (cada /clear ou nova sessão recria o cache inteiro)',
					),
					L(
						'Reduzca el tamaño del CLAUDE.md — mantenga solo lo esencial',
						'Reduza o tamanho do CLAUDE.md — mantenha apenas o essencial',
					),
					L(
						'Cierre pestañas/archivos no relevantes para la tarea actual antes de pedir al Claude',
						'Feche abas/arquivos que não são relevantes para a tarefa atual antes de pedir ao Claude',
					),
					L(
						'Use conversaciones largas y continuas en vez de muchas cortas para la misma tarea',
						'Use conversas longas e contínuas em vez de muitas conversas curtas para a mesma tarefa',
					),
					L(
						'Si es posible, agrupe tareas relacionadas en la misma sesión para reutilizar el cache',
						'Se possível, agrupe tarefas relacionadas na mesma sessão para reaproveitar o cache',
					),
				],
				risks: L(
					'Conversaciones muy largas pueden volverse lentas. Balance entre sesiones largas (mejor cache) y sesiones enfocadas (mejor calidad).',
					'Conversas muito longas podem ficar lentas. Balance entre sessões longas (melhor cache) e sessões focadas (melhor qualidade).',
				),
			});
		}

		if (avgDaily > 100) {
			actions.push({
				title: L(
					'Implementar límites de gasto por proyecto',
					'Implementar limites de gasto por projeto',
				),
				description: L(
					`Con un promedio de $${avgDaily.toFixed(0)}/día, la proyección mensual es de ~$${(avgDaily * 30).toFixed(0)}. Sin control, este valor puede escalar rápidamente. Configure alertas en este dashboard para ser notificado antes de superar el budget.`,
					`Com uma média de $${avgDaily.toFixed(0)}/dia, a projeção mensal é de ~$${(avgDaily * 30).toFixed(0)}. Sem controle, esse valor pode escalar rapidamente. Configure alertas neste dashboard para ser notificado antes de ultrapassar o budget.`,
				),
				saving: L('Control preventivo', 'Controle preventivo'),
				steps: [
					L(
						'Vaya a "Alertas y Límites" y configure un límite mensual realista',
						'Vá em "Alertas & Limites" e configure um limite mensal realista',
					),
					L(
						'Monitoree este dashboard diariamente — 5 minutos de chequeo pueden evitar sorpresas',
						'Monitore este dashboard diariamente — 5 minutos de checagem podem evitar surpresas',
					),
					L(
						'Identifique proyectos con costo desproporcionado en la pestaña "Proyectos"',
						'Identifique projetos com custo desproporcional na aba "Projetos"',
					),
					L(
						'Defina un "budget por conversación" interno — si una tarea está costando mucho, pause y reevalúe',
						'Defina um "budget por conversa" interno — se uma tarefa está custando muito, pause e reavalie',
					),
				],
				risks: null,
			});
		}

		const termBlock = (cmd: string) =>
			`<div class="term-block"><span class="term-prompt">$</span><span class="term-cmd">${cmd}</span><button class="term-copy" onclick="navigator.clipboard.writeText('${cmd.replace(/'/g, "\\'")}')"><svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg></button></div>`;
		const codeInline = (cmd: string) => `<span class="code-inline">${cmd}</span>`;

		actions.push({
			title: L(
				'Tutorial: Estrategias para dejar de quemar tokens',
				'Tutorial: Estratégias para parar de queimar tokens',
			),
			description: `
				<p>${L('Para controlar el costo financiero, tenés tres alternativas de flujo de trabajo en Claude Code. Evaluá cuál tiene más sentido para tu día a día:', 'Para controlar o custo financeiro, você tem três alternativas de fluxo de trabalho no Claude Code. Avalie qual faz mais sentido para o seu dia a dia:')}</p>
				<div style="margin-top: 12px; display: flex; flex-direction: column; gap: 16px;">
					<div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px;">
						<h5 style="margin: 0 0 8px 0; font-size: 14px; color: #1e293b;">${L('Opción 1: Limpieza Total', 'Opção 1: Limpeza Total')}</h5>
						<p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>${L('Cómo usar:', 'Como usar:')}</strong> ${L('En la terminal de Claude Code, escribí:', 'No terminal do Claude Code, digite:')}</p>
						${termBlock('/clear')}
						<p style="margin: 8px 0 0 0; font-size: 13px; color: #475569;">🟢 <strong>${L('Pros:', 'Prós:')}</strong> ${L('Solución más barata. El costo de la próxima solicitud cae a cero.', 'Solução mais barata. O custo da próxima requisição despenca para zero.')}<br>
						🔴 <strong>${L('Contras:', 'Contras:')}</strong> ${L('La IA olvida todo el proyecto. Vas a tener que explicar el objetivo de nuevo.', 'A IA esquece todo o projeto. Você terá que explicar o objetivo novamente.')}</p>
					</div>
					<div style="background: #f8fafc; border-left: 4px solid #8b5cf6; padding: 12px 16px; border-radius: 4px;">
						<h5 style="margin: 0 0 8px 0; font-size: 14px; color: #1e293b;">${L('Opción 2: Compactación de Memoria', 'Opção 2: Compactação de Memória')}</h5>
						<p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>${L('Cómo usar:', 'Como usar:')}</strong> ${L('Cuando la conversación se ponga muy larga y cara, escribí:', 'Quando a conversa ficar muito longa e cara, digite:')}</p>
						${termBlock('/compact')}
						<p style="margin: 8px 0 0 0; font-size: 13px; color: #475569;">🟢 <strong>${L('Pros:', 'Prós:')}</strong> ${L('Descarta el historial pesado sin perder el contexto de la tarea actual.', 'Joga o histórico pesado fora sem perder o contexto da tarefa atual.')}<br>
						🔴 <strong>${L('Contras:', 'Contras:')}</strong> ${L('Cuesta tokens extras para que la IA genere el resumen antes de compactar.', 'Custa tokens extras para a própria IA gerar o resumo antes de compactar.')}</p>
					</div>
					<div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 4px;">
						<h5 style="margin: 0 0 8px 0; font-size: 14px; color: #1e293b;">${L('Opción 3: Filtrado de Contexto Local', 'Opção 3: Filtragem de Contexto Local')}</h5>
						<p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>${L('Cómo usar:', 'Como usar:')}</strong> ${L(`Creá el archivo ${codeInline('.claudeignore')} en la raíz del proyecto y bloqueá carpetas/archivos pesados:`, `Crie o arquivo ${codeInline('.claudeignore')} na raiz do projeto e bloqueie pastas/arquivos pesados:`)}</p>
						${termBlock('touch .claudeignore')}
						<p style="margin: 8px 0 4px 0; font-size: 12px; color: #64748b;">${L(`Ejemplo de contenido del ${codeInline('.claudeignore')}:`, `Exemplo de conteúdo do ${codeInline('.claudeignore')}:`)}</p>
						<pre class="term-pre">*.pdf\nlogs/\nnode_modules/\n*.log\ndist/</pre>
						<p style="margin: 8px 0 0 0; font-size: 13px; color: #475569;">🟢 <strong>${L('Pros:', 'Prós:')}</strong> ${L('Impide que la IA lea PDFs enormes o archivos inútiles accidentalmente.', 'Impede que a IA leia PDFs imensos ou arquivos inúteis acidentalmente.')}<br>
						🔴 <strong>${L('Contras:', 'Contras:')}</strong> ${L('Requiere configuración manual, pero es <strong>obligatorio</strong> en la rutina.', 'Requer configuração manual, mas é <strong>obrigatório</strong> na rotina.')}</p>
					</div>
				</div>
			`,
			saving: L('Hasta 90% de reducción en Cache Read', 'Até 90% de redução no Cache Read'),
			steps: [],
			risks: null,
		});

		actions.push({
			title: L(
				'Tutorial: Optimización de los archivos CLAUDE.md',
				'Tutorial: Otimização dos arquivos CLAUDE.md',
			),
			description: `
				<p style="margin-bottom: 12px;">${L(`El archivo ${codeInline('CLAUDE.md')} dicta el comportamiento del agente. Como se lee en <strong>cada prompt</strong>, instrucciones ineficientes multiplican sus costos.`, `O arquivo ${codeInline('CLAUDE.md')} dita o comportamento do agente. Como ele é lido a <strong>cada prompt</strong>, instruções ineficientes multiplicam seus custos.`)}</p>
				<p style="margin-bottom: 8px; font-size: 13px;"><strong>Global</strong> (${L('afecta todos los proyectos', 'afeta todos os projetos')}):</p>
				${termBlock('code ~/.claude/CLAUDE.md')}
				<p style="margin: 12px 0 8px; font-size: 13px;"><strong>Local</strong> (${L('afecta solo la carpeta del proyecto', 'afeta apenas a pasta do projeto')}):</p>
				${termBlock('code CLAUDE.md')}
				<p style="font-weight: 600; margin: 16px 0 8px;">${L('Agregá exactamente este snippet en inglés para forzar al agente a ser super económico:', 'Adicione exatamente este snippet em inglês para forçar o agente a ser super econômico:')}</p>
				<div style="position:relative">
					<button class="term-copy" style="position:absolute;top:8px;right:8px;" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)"><svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg></button>
					<pre class="term-pre"><code># Token Economy (CRITICAL)
- **Low-Cost Navigation:** Use \`grep/find\` before reading entire files. Use \`offset+limit\` to read only necessary blocks. DO NOT re-read unchanged files.
- **Surgical Editing (Edit > Write):** NEVER rewrite an entire file just to change 3 lines. Modify only the necessary block using tools.
- **Zero Fluff:** No intros. No long conclusions. No "Before/After" tables (unless explicitly requested). Maximum 1 to 2 short sentences at the end of your turn.
- **Agent Efficiency:** Do not invoke subagents for tasks that can be solved with 2 or 3 direct tool calls.</code></pre>
				</div>
			`,
			saving: 'Token Economy (CRITICAL)',
			steps: [],
			risks: null,
		});

		// Warnings
		const warnings = [];
		if (opusPct > 70)
			warnings.push(
				L(
					`${shortModel(topModelName)} concentra el ${opusPct.toFixed(0)}% de los costos — cada conversación en Opus cuesta ~5x más que en Sonnet`,
					`${shortModel(topModelName)} concentra ${opusPct.toFixed(0)}% dos custos — cada conversa em Opus custa ~5x mais que em Sonnet`,
				),
			);
		if (avgDaily > 300)
			warnings.push(
				L(
					`Promedio diario de $${avgDaily.toFixed(0)} — proyección anual: $${(avgDaily * 365).toFixed(0)}`,
					`Média diária de $${avgDaily.toFixed(0)} — projeção anual: $${(avgDaily * 365).toFixed(0)}`,
				),
			);
		if (highCacheCreate)
			warnings.push(
				L(
					`${(totalCacheCreate / 1e6).toFixed(1)}M tokens gastados en recreación de cache — el contexto se está reprocesando excesivamente`,
					`${(totalCacheCreate / 1e6).toFixed(1)}M tokens gastos em recriação de cache — o contexto está sendo reprocessado excessivamente`,
				),
			);
		const costs7d = dailyData.slice(-7).map((d: any) => d.totalCost);
		const costs7dPrev = dailyData.slice(-14, -7).map((d: any) => d.totalCost);
		if (costs7d.length >= 7 && costs7dPrev.length >= 7) {
			const avg7 = costs7d.reduce((a: number, b: number) => a + b, 0) / 7;
			const avgPrev = costs7dPrev.reduce((a: number, b: number) => a + b, 0) / 7;
			if (avg7 > avgPrev * 1.3)
				warnings.push(
					L(
						`Tendencia al alza: gasto de los últimos 7 días es ${((avg7 / avgPrev - 1) * 100).toFixed(0)}% mayor que la semana anterior`,
						`Tendência de alta: gasto dos últimos 7 dias é ${((avg7 / avgPrev - 1) * 100).toFixed(0)}% maior que a semana anterior`,
					),
				);
		}

		return c.json({
			totalCost: totals.totalCost,
			totalDays: dailyData.length,
			topModel: { name: topModelName, cost: topModelCost, pct: opusPct },
			avgDaily,
			potentialSaving,
			diagnosis,
			actions,
			warnings,
		});
	});

	// ─── API: Projects breakdown ────────────────────────────
	app.get('/api/projects', async (c) => {
		const dailyRaw = (await runCcusage(opts, 'daily', ['--instances'])) as any;
		const dailyData = dailyRaw?.daily ?? [];

		// If we got project-grouped data from "projects" key
		const projectsObj = dailyRaw?.projects;
		if (projectsObj && typeof projectsObj === 'object') {
			const projects = Object.entries(projectsObj)
				.map(([name, entries]: [string, any]) => {
					const totalCost = entries.reduce((a: number, e: any) => a + (e.totalCost ?? 0), 0);
					const totalTokens = entries.reduce((a: number, e: any) => a + (e.totalTokens ?? 0), 0);
					const days = new Set(entries.map((e: any) => e.date));
					return {
						name,
						totalCost,
						totalTokens,
						activeDays: days.size,
						limit: thresholdConfig.projectLimits[name] ?? null,
					};
				})
				.sort((a, b) => b.totalCost - a.totalCost);
			return c.json({ projects });
		}

		// Fallback: aggregate from daily data with project field
		const projectMap = new Map<string, { cost: number; tokens: number; days: Set<string> }>();
		for (const d of dailyData) {
			const proj = d.project ?? 'unknown';
			const existing = projectMap.get(proj) ?? { cost: 0, tokens: 0, days: new Set<string>() };
			existing.cost += d.totalCost ?? 0;
			existing.tokens += d.totalTokens ?? 0;
			existing.days.add(d.date);
			projectMap.set(proj, existing);
		}

		const projects = Array.from(projectMap.entries())
			.map(([name, data]) => ({
				name,
				totalCost: data.cost,
				totalTokens: data.tokens,
				activeDays: data.days.size,
				limit: thresholdConfig.projectLimits[name] ?? null,
			}))
			.sort((a, b) => b.totalCost - a.totalCost);
		return c.json({ projects });
	});

	// ─── API: Watcher Status (Real-time daemon state) ───────
	app.get('/api/watcher', (c) => {
		return c.json(getWatcherState());
	});

	app.post('/api/watcher/config', async (c) => {
		const body = (await c.req.json()) as { slackWebhookUrl?: string };
		if (body.slackWebhookUrl !== undefined) {
			saveConfig({ slackWebhookUrl: body.slackWebhookUrl || null });
		}
		return c.json({ success: true, config: getWatcherState().config });
	});

	// ─── API: SSE — Live Updates ────────────────────────────
	app.get('/api/events', (c) => {
		const stream = new ReadableStream({
			start(controller) {
				const encoder = new TextEncoder();
				const send = (data: string) => {
					try {
						controller.enqueue(encoder.encode(`data: ${data}\n\n`));
					} catch {
						/* closed */
					}
				};

				// Send initial state
				send(
					JSON.stringify({
						type: 'connected',
						data: getWatcherState(),
						timestamp: new Date().toISOString(),
					}),
				);

				// Subscribe to watcher events
				const unsub = subscribe((event) => send(JSON.stringify(event)));

				// Heartbeat every 30s
				const hb = setInterval(
					() => send(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })),
					30000,
				);

				// Cleanup on close
				c.req.raw.signal.addEventListener('abort', () => {
					unsub();
					clearInterval(hb);
				});
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	});

	// ─── Serve Static Files ─────────────────────────────────
	const publicDir = path.join(__dirname, 'public');
	const mimeTypes: Record<string, string> = {
		'.html': 'text/html',
		'.css': 'text/css',
		'.js': 'application/javascript',
		'.json': 'application/json',
		'.png': 'image/png',
		'.svg': 'image/svg+xml',
	};

	app.get('/', (c) => {
		const html = readFileSync(path.join(publicDir, 'index.html'), 'utf-8');
		return c.html(html);
	});

	app.get('/:file{.+\\..+}', (c) => {
		const file = c.req.param('file');
		const filePath = path.join(publicDir, file);
		try {
			const content = readFileSync(filePath);
			const ext = path.extname(file);
			const mime = mimeTypes[ext] ?? 'application/octet-stream';
			return new Response(content, { headers: { 'Content-Type': mime } });
		} catch {
			return c.notFound();
		}
	});

	return app;
}
