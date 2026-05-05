/* Pages logic */
let _sum = null;

async function loadOverview() {
	const el = document.getElementById('ov-content');
	skel('ov-content');
	const [data, daily] = await Promise.all([api('/api/summary'), api('/api/daily')]);
	_sum = data;
	const al = data.threshold.alertLevel;
	const last = daily.daily.slice(-30);
	let h = head('layout-dashboard', t('ov.title'), t('ov.sub'));
	if (al === 'critical')
		h +=
			'<div class="alert critical">' +
			ico('alert-triangle') +
			' ' +
			t('alert.critical', { pct: fmtP(data.threshold.usagePercent) }) +
			'</div>';
	else if (al === 'warning')
		h +=
			'<div class="alert warning">' +
			ico('alert-triangle') +
			' ' +
			t('alert.warning', { pct: fmtP(data.threshold.usagePercent) }) +
			'</div>';
	// Top project name (clean basename)
	const tp = data.topProject || { name: 'N/A', cost: 0 };
	const sp = data.secondProject;
	const projLabel = sp ? tp.name + ' vs ' + sp.name : tp.name;
	const projSub = sp ? fmt(tp.cost) + ' vs ' + fmt(sp.cost) : fmt(tp.cost);
	const ic = [
		{ bg: '#ede9fe', fg: '#7c3aed' },
		{ bg: '#dbeafe', fg: '#3b82f6' },
		{
			bg: al === 'critical' ? '#fee2e2' : '#d1fae5',
			fg: al === 'critical' ? '#ef4444' : '#22c55e',
		},
		{ bg: '#fef3c7', fg: '#f59e0b' },
		{ bg: '#fce7f3', fg: '#ec4899' },
		{ bg: '#e0e7ff', fg: '#6366f1' },
	];
	const logSize = data.logSizeBytes || 0;
	const cards = [
		{
			l: t('kpi.totalCost'),
			v: fmt(data.totalCost),
			s: t('kpi.days', { n: data.totalDays }),
			i: 'wallet',
			c: '',
		},
		{
			l: t('kpi.today'),
			v: fmt(data.todayCost),
			s: t('kpi.models', { n: data.totalModels }),
			i: 'clock',
			c: '',
		},
		{
			l: t('kpi.monthSpend'),
			v: fmt(data.currentMonthCost),
			s: t('kpi.ofLimit', { pct: fmtP(data.threshold.usagePercent) }),
			i: 'gauge',
			c: al === 'critical' ? 'crit' : al === 'warning' ? 'warn' : '',
		},
		{
			l: t('kpi.projection'),
			v: fmt(data.projectedMonthlyCost),
			s: t('kpi.remaining', { v: fmt(data.threshold.remaining) }),
			i: 'trending-up',
			c: '',
		},
		{ l: t('kpi.topProject'), v: tp.name, s: projSub, i: 'folder-kanban', c: '' },
		{ l: t('kpi.logSize'), v: fmtBytes(logSize), s: '~/.claude/projects/', i: 'hard-drive', c: '' },
	];
	h +=
		'<div class="kpi-grid">' +
		cards
			.map(
				(c, i) =>
					'<div class="kpi-card ' +
					c.c +
					'" onclick="kpiModal(' +
					i +
					')"><div class="top"><span class="lbl">' +
					c.l +
					'</span><div class="ico" style="background:' +
					ic[i].bg +
					';color:' +
					ic[i].fg +
					'">' +
					ico(c.i) +
					'</div></div><div class="val">' +
					c.v +
					'</div><div class="sub">' +
					c.s +
					'</div><div class="hint">' +
					t('kpi.clickDetails') +
					'</div></div>',
			)
			.join('') +
		'</div>';
	h +=
		'<div class="g2"><div class="crd"><h3>' +
		ico('trending-up') +
		' ' +
		t('chart.dailyCost') +
		'</h3><canvas id="c1"></canvas></div>';
	h +=
		'<div class="crd"><h3>' +
		ico('pie-chart') +
		' ' +
		t('chart.costByModel') +
		'</h3><canvas id="c2"></canvas></div></div>';
	h +=
		'<div class="g2"><div class="crd full"><h3>' +
		ico('bar-chart-3') +
		' ' +
		t('chart.tokensByType') +
		'</h3><canvas id="c3"></canvas></div></div>';
	el.innerHTML = h;
	lucide.createIcons();
	dc('c1');
	charts.c1 = new Chart(document.getElementById('c1'), {
		type: 'bar',
		data: {
			labels: last.map((d) => d.date.slice(5)),
			datasets: [
				{
					label: t('chart.cost'),
					data: last.map((d) => d.totalCost),
					backgroundColor: last.map((_, i) => C[i % C.length] + 'cc'),
					borderRadius: 6,
				},
			],
		},
		options: {
			responsive: true,
			plugins: { legend: { display: false } },
			scales: {
				y: { beginAtZero: true, grid: { color: '#f4f4f5' }, ticks: { callback: (v) => '$' + v } },
				x: { grid: { display: false } },
			},
		},
	});
	dc('c2');
	if (data.modelBreakdown.length)
		charts.c2 = new Chart(document.getElementById('c2'), {
			type: 'doughnut',
			data: {
				labels: data.modelBreakdown.map((m) => sm(m.model)),
				datasets: [
					{
						data: data.modelBreakdown.map((m) => m.cost),
						backgroundColor: C.slice(0, data.modelBreakdown.length),
						borderWidth: 3,
						borderColor: '#fff',
						hoverOffset: 8,
					},
				],
			},
			options: { responsive: true, cutout: '62%', plugins: { legend: { position: 'bottom' } } },
		});
	dc('c3');
	charts.c3 = new Chart(document.getElementById('c3'), {
		type: 'bar',
		data: {
			labels: last.map((d) => d.date.slice(5)),
			datasets: [
				{
					label: t('chart.input'),
					data: last.map((d) => d.inputTokens),
					backgroundColor: '#7c3aed',
				},
				{
					label: t('chart.output'),
					data: last.map((d) => d.outputTokens),
					backgroundColor: '#3b82f6',
				},
				{
					label: t('chart.cacheCreate'),
					data: last.map((d) => d.cacheCreationTokens),
					backgroundColor: '#14b8a6',
				},
				{
					label: t('chart.cacheRead'),
					data: last.map((d) => d.cacheReadTokens),
					backgroundColor: '#f59e0b',
				},
			],
		},
		options: {
			responsive: true,
			scales: {
				x: { stacked: true, grid: { display: false } },
				y: { stacked: true, grid: { color: '#f4f4f5' }, ticks: { callback: (v) => fmtK(v) } },
			},
			plugins: { legend: { position: 'bottom' } },
		},
	});
}

function kpiModal(i) {
	if (!_sum) return;
	const d = _sum;
	const tp = d.topProject || { name: 'N/A', cost: 0 };
	const sp = d.secondProject;
	const titles = [
		t('modal.totalCost'),
		t('modal.today'),
		t('modal.monthSpend'),
		t('modal.projection'),
		t('modal.projects'),
		t('modal.logSize'),
	];
	const bodies = [
		() =>
			d.modelBreakdown
				.map(
					(m) =>
						'<div class="ms"><span class="l">' +
						sm(m.model) +
						'</span><span class="v c">' +
						fmt(m.cost) +
						' (' +
						fmtP(d.totalCost > 0 ? (m.cost / d.totalCost) * 100 : 0) +
						')</span></div>',
				)
				.join('') +
			'<div class="ms"><span class="l"><b>' +
			t('modal.avgDay') +
			'</b></span><span class="v c">' +
			fmt(d.totalCost / Math.max(d.totalDays, 1)) +
			'</span></div>',
		() =>
			'<div class="ms"><span class="l">' +
			t('modal.today') +
			'</span><span class="v c">' +
			fmt(d.todayCost) +
			'</span></div><div class="ms"><span class="l">' +
			t('modal.models') +
			'</span><span class="v">' +
			d.totalModels +
			'</span></div>',
		() => {
			const p = d.threshold.usagePercent;
			const cls = p >= 95 ? 'critical' : p >= 80 ? 'warning' : '';
			return (
				'<div style="font-size:36px;font-weight:900;color:var(--primary)">' +
				fmt(d.currentMonthCost) +
				'</div><div class="bb-bg"><div class="bb-fill ' +
				cls +
				'" style="width:' +
				Math.min(p, 100) +
				'%"></div></div><div class="bb-lbl"><span>' +
				fmtP(p) +
				'</span><span>' +
				fmt(d.threshold.monthlyLimit) +
				'</span></div>'
			);
		},
		() =>
			'<div class="ms"><span class="l">' +
			t('modal.proj_label') +
			'</span><span class="v c">' +
			fmt(d.projectedMonthlyCost) +
			'</span></div><div class="ms"><span class="l">' +
			t('modal.currentSpend') +
			'</span><span class="v c">' +
			fmt(d.currentMonthCost) +
			'</span></div><div class="ms"><span class="l">' +
			t('modal.remaining') +
			'</span><span class="v c">' +
			fmt(d.threshold.remaining) +
			'</span></div>',
		() => {
			const ap = d.allProjects || [];
			const tc = ap.reduce((a, p) => a + p.cost, 0);
			let h = '';
			ap.forEach((p, i) => {
				const isWarn = p.name.startsWith('⚠');
				h +=
					'<div class="ms"><span class="l"' +
					(isWarn ? ' style="color:var(--danger);font-weight:700"' : '') +
					'>' +
					(isWarn ? '' : '<b>#' + (i + 1) + '</b> ') +
					p.name +
					'</span><span class="v c">' +
					fmt(p.cost) +
					' (' +
					fmtP(tc > 0 ? (p.cost / tc) * 100 : 0) +
					')</span></div>';
			});
			if (ap.some((p) => p.name.startsWith('⚠')))
				h +=
					'<div style="margin-top:12px;padding:10px;background:#fef2f2;border-radius:8px;font-size:12px;color:#991b1b;border:1px solid #fecaca">' +
					t('modal.projWarning') +
					'</div>';
			h +=
				'<div style="margin-top:12px;font-size:11px;color:var(--gray-400)">' +
				t('modal.projFooter') +
				'</div>';
			return h;
		},
		() => {
			const ls = d.logSizeBytes || 0;
			return (
				'<div style="text-align:center;margin-bottom:16px"><div style="font-size:42px;font-weight:900;color:#6366f1">' +
				fmtBytes(ls) +
				'</div><div style="font-size:12px;color:var(--gray-400);margin-top:4px">~/.claude/projects/</div></div>' +
				'<div class="ms"><span class="l">' +
				t('modal.totalSize') +
				'</span><span class="v">' +
				fmtBytes(ls) +
				'</span></div>' +
				'<div class="ms"><span class="l">' +
				t('modal.bytes') +
				'</span><span class="v" style="font-family:monospace">' +
				ls.toLocaleString() +
				'</span></div>' +
				'<div style="margin-top:16px;padding:12px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;font-size:12px;color:#1e40af">' +
				t('modal.logInfo') +
				'</div>'
			);
		},
	];
	openModal(titles[i], bodies[i]());
}

async function loadDaily() {
	skel('dy-content');
	const s = document.getElementById('daily-since')?.value?.replace(/-/g, '') || '';
	const u = document.getElementById('daily-until')?.value?.replace(/-/g, '') || '';
	let url = '/api/daily';
	const p = [];
	if (s) p.push('since=' + s);
	if (u) p.push('until=' + u);
	if (p.length) url += '?' + p.join('&');
	const data = await api(url);
	let h = head('calendar-days', t('daily.title'), t('daily.sub'));
	h +=
		'<div class="filters"><input type="date" id="daily-since"><input type="date" id="daily-until"><button class="btn btn-p" onclick="loadDaily()">' +
		ico('filter') +
		' ' +
		t('daily.filter') +
		'</button></div>';
	h +=
		'<div class="crd" style="margin-bottom:16px"><h3>' +
		ico('bar-chart-3') +
		' ' +
		t('daily.chart') +
		'</h3><canvas id="cd1"></canvas></div>';
	h +=
		'<div class="crd"><h3>' +
		ico('table-2') +
		' ' +
		t('daily.details') +
		'</h3><div class="tw">' +
		tbl(
			[
				t('th.date'),
				t('th.input'),
				t('th.output'),
				t('th.cacheCreate'),
				t('th.cacheRead'),
				t('th.total'),
				t('th.cost'),
				t('th.models'),
			],
			data.daily.map((d) => [
				d.date,
				fmtK(d.inputTokens),
				fmtK(d.outputTokens),
				fmtK(d.cacheCreationTokens),
				fmtK(d.cacheReadTokens),
				fmtK(d.totalTokens),
				fmt(d.totalCost),
				d.modelsUsed.map(sm).join(', '),
			]),
		) +
		'</div></div>';
	document.getElementById('dy-content').innerHTML = h;
	lucide.createIcons();
	dc('cd1');
	charts.cd1 = new Chart(document.getElementById('cd1'), {
		type: 'bar',
		data: {
			labels: data.daily.map((d) => d.date),
			datasets: [
				{
					label: t('chart.cost'),
					data: data.daily.map((d) => d.totalCost),
					backgroundColor: data.daily.map((_, i) => C[i % C.length] + 'cc'),
				},
			],
		},
		options: {
			responsive: true,
			plugins: { legend: { display: false } },
			scales: {
				y: { beginAtZero: true, grid: { color: '#f4f4f5' }, ticks: { callback: (v) => '$' + v } },
				x: { grid: { display: false } },
			},
		},
	});
}

async function loadMonthly() {
	skel('mo-content');
	const data = await api('/api/monthly');
	let h = head('calendar-range', t('monthly.title'), t('monthly.sub'));
	h +=
		'<div class="crd" style="margin-bottom:16px"><h3>' +
		ico('bar-chart-3') +
		' ' +
		t('monthly.chart') +
		'</h3><canvas id="cm1"></canvas></div>';
	h +=
		'<div class="crd"><h3>' +
		ico('table-2') +
		' ' +
		t('monthly.details') +
		'</h3><div class="tw">' +
		tbl(
			[
				t('th.month'),
				t('th.input'),
				t('th.output'),
				t('th.cacheCreate'),
				t('th.cacheRead'),
				t('th.total'),
				t('th.cost'),
			],
			data.monthly.map((d) => [
				fmtMonth(d.month),
				fmtK(d.inputTokens),
				fmtK(d.outputTokens),
				fmtK(d.cacheCreationTokens),
				fmtK(d.cacheReadTokens),
				fmtK(d.totalTokens),
				fmt(d.totalCost),
			]),
		) +
		'</div></div>';
	document.getElementById('mo-content').innerHTML = h;
	lucide.createIcons();
	dc('cm1');
	charts.cm1 = new Chart(document.getElementById('cm1'), {
		type: 'bar',
		data: {
			labels: data.monthly.map((d) => fmtMonth(d.month)),
			datasets: [
				{
					label: t('chart.cost'),
					data: data.monthly.map((d) => d.totalCost),
					backgroundColor: C.slice(0, data.monthly.length),
				},
			],
		},
		options: {
			responsive: true,
			plugins: { legend: { display: false } },
			scales: {
				y: { beginAtZero: true, grid: { color: '#f4f4f5' }, ticks: { callback: (v) => '$' + v } },
				x: { grid: { display: false } },
			},
		},
	});
}

async function loadProjects() {
	skel('pj-content');
	const data = await api('/api/projects');
	const top = data.projects.slice(0, 12);
	let h = head('folder-kanban', t('proj.title'), t('proj.sub'));
	h +=
		'<div class="crd" style="margin-bottom:16px"><h3>' +
		ico('bar-chart-horizontal') +
		' ' +
		t('proj.topChart') +
		'</h3><canvas id="cp1"></canvas></div>';
	h +=
		'<div class="crd"><h3>' +
		ico('table-2') +
		' ' +
		t('proj.allTable') +
		'</h3><div class="tw">' +
		tbl(
			[t('th.project'), t('th.totalCost'), t('th.tokens'), t('th.days')],
			data.projects.map((p) => [p.name, fmt(p.totalCost), fmtK(p.totalTokens), p.activeDays]),
		) +
		'</div></div>';
	document.getElementById('pj-content').innerHTML = h;
	lucide.createIcons();
	dc('cp1');
	charts.cp1 = new Chart(document.getElementById('cp1'), {
		type: 'bar',
		data: {
			labels: top.map((p) => p.name.split('-').slice(-2).join('-').slice(0, 20)),
			datasets: [
				{
					label: t('chart.cost'),
					data: top.map((p) => p.totalCost),
					backgroundColor: C.slice(0, top.length),
				},
			],
		},
		options: {
			indexAxis: 'y',
			responsive: true,
			plugins: { legend: { display: false } },
			scales: {
				x: { beginAtZero: true, grid: { color: '#f4f4f5' }, ticks: { callback: (v) => '$' + v } },
				y: { grid: { display: false } },
			},
		},
	});
}

async function loadSessions() {
	skel('ss-content');
	const data = await api('/api/sessions');
	const sorted = data.sessions.sort((a, b) => b.totalCost - a.totalCost).slice(0, 50);
	let h = head('messages-square', t('sess.title'), t('sess.sub'));
	h +=
		'<div class="crd"><div class="tw">' +
		tbl(
			[t('th.session'), t('th.project'), t('th.env'), t('th.tools'), t('th.cost')],
			sorted.map((s) => {
				let sn = s.aiTitle
					? '<div style="font-weight:600;color:var(--gray-900)">' +
						s.aiTitle +
						'</div><div style="font-size:11px;color:var(--gray-400)">ID: ' +
						s.sessionId.slice(0, 14) +
						'…</div>'
					: '<div style="color:var(--gray-700)">ID: ' + s.sessionId.slice(0, 14) + '…</div>';
				if (s.hasErrors)
					sn +=
						'<span class="badge badge-r" style="font-size:9px;padding:2px 4px;margin-top:4px">⚠️ Error/Alerta</span>';

				let pi = '<div style="font-weight:500">' + s.projectPath + '</div>';
				if (s.cwd && s.cwd !== s.projectPath)
					pi +=
						'<div style="font-size:11px;color:var(--gray-500);margin-top:2px">📂 ' +
						s.cwd.split('/').slice(-2).join('/') +
						'</div>';
				if (s.gitBranch && s.gitBranch !== 'HEAD')
					pi +=
						'<div style="font-size:11px;color:var(--primary);margin-top:2px">🌿 ' +
						s.gitBranch +
						'</div>';

				let tl = '';
				if (s.toolsUsed && Object.keys(s.toolsUsed).length > 0) {
					tl =
						'<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;max-width:200px;margin-left:auto">' +
						Object.entries(s.toolsUsed)
							.map(
								([k, v]) =>
									'<span class="badge" style="background:#f1f5f9;color:#475569;font-size:10px;padding:2px 6px">' +
									k +
									' <span style="opacity:0.6">(' +
									v +
									')</span></span>',
							)
							.join('') +
						'</div>';
				} else {
					tl = '<span style="color:var(--gray-400)">-</span>';
				}

				let env =
					s.entrypoint === 'claude-vscode'
						? '🖥️ VS Code'
						: s.entrypoint === 'cli'
							? '💻 CLI'
							: '🤖 API';

				return [
					sn,
					pi,
					env,
					tl,
					'<div style="font-weight:700;color:var(--gray-900)">' +
						fmt(s.totalCost) +
						'</div><div style="font-size:11px;color:var(--gray-500)">' +
						fmtK(s.totalTokens) +
						' tk</div>',
				];
			}),
		) +
		'</div></div>';
	document.getElementById('ss-content').innerHTML = h;
	lucide.createIcons();
}

async function loadModels() {
	skel('md-content');
	const data = await api('/api/summary');
	const mb = data.modelBreakdown;
	let h = head('cpu', t('mod.title'), t('mod.sub'));
	h +=
		'<div class="g2"><div class="crd"><h3>' +
		ico('bar-chart-3') +
		' ' +
		t('mod.costChart') +
		'</h3><canvas id="cmb"></canvas></div>';
	h +=
		'<div class="crd"><h3>' +
		ico('pie-chart') +
		' ' +
		t('mod.tokenDist') +
		'</h3><canvas id="cmp"></canvas></div></div>';
	h +=
		'<div class="crd"><h3>' +
		ico('table-2') +
		' ' +
		t('mod.details') +
		'</h3><div class="tw">' +
		tbl(
			[t('th.model'), t('th.cost'), t('th.tokens'), t('th.pctCost')],
			mb.map((m) => [
				m.model,
				fmt(m.cost),
				fmtK(m.tokens),
				fmtP(data.totalCost > 0 ? (m.cost / data.totalCost) * 100 : 0),
			]),
		) +
		'</div></div>';
	document.getElementById('md-content').innerHTML = h;
	lucide.createIcons();
	dc('cmb');
	charts.cmb = new Chart(document.getElementById('cmb'), {
		type: 'bar',
		data: {
			labels: mb.map((m) => sm(m.model)),
			datasets: [{ data: mb.map((m) => m.cost), backgroundColor: C.slice(0, mb.length) }],
		},
		options: {
			responsive: true,
			plugins: { legend: { display: false } },
			scales: {
				y: { beginAtZero: true, grid: { color: '#f4f4f5' }, ticks: { callback: (v) => '$' + v } },
				x: { grid: { display: false } },
			},
		},
	});
	dc('cmp');
	charts.cmp = new Chart(document.getElementById('cmp'), {
		type: 'doughnut',
		data: {
			labels: mb.map((m) => sm(m.model)),
			datasets: [
				{
					data: mb.map((m) => m.tokens),
					backgroundColor: C.slice(0, mb.length),
					borderWidth: 3,
					borderColor: '#fff',
				},
			],
		},
		options: { responsive: true, cutout: '60%', plugins: { legend: { position: 'bottom' } } },
	});
}

async function loadAlerts() {
	skel('al-content');
	const [cfg, s, w] = await Promise.all([
		api('/api/thresholds'),
		api('/api/summary'),
		api('/api/watcher'),
	]);
	const al = s.threshold.alertLevel;
	const p = s.threshold.usagePercent;
	const cls = al === 'critical' ? 'critical' : al === 'warning' ? 'warning' : '';
	let h = head('shield-alert', t('al.title'), t('al.sub'));
	h +=
		'<div class="g2"><div class="crd"><h3>' +
		ico('sliders-horizontal') +
		' ' +
		t('al.configTitle') +
		'</h3>';
	h +=
		'<div class="fg"><label>' +
		t('al.monthlyLimit') +
		'</label><input type="number" id="cfg-lim" value="' +
		cfg.monthlyLimit +
		'" step="50"></div>';
	h +=
		'<div class="fg"><label>' +
		t('al.warningPct') +
		'</label><input type="number" id="cfg-w" value="' +
		cfg.warningPercent +
		'"></div>';
	h +=
		'<div class="fg"><label>' +
		t('al.criticalPct') +
		'</label><input type="number" id="cfg-c" value="' +
		cfg.criticalPercent +
		'"></div>';
	h +=
		'<button class="btn btn-p" onclick="saveThresholds()">' +
		ico('save') +
		' ' +
		t('al.saveBtn') +
		'</button><div id="ts" style="margin-top:10px"></div></div>';
	h += '<div class="crd"><h3>' + ico('gauge') + ' ' + t('al.budgetStatus') + '</h3>';
	h +=
		'<div style="font-size:48px;font-weight:900;color:' +
		(al === 'critical' ? 'var(--danger)' : al === 'warning' ? 'var(--warning)' : 'var(--primary)') +
		'">' +
		fmtP(p) +
		'</div>';
	h +=
		'<div style="font-size:12px;color:var(--gray-500);margin:2px 0 8px">' +
		t('al.ofLimit', { v: fmt(cfg.monthlyLimit) }) +
		'</div>';
	h +=
		'<div class="bb-bg"><div class="bb-fill ' +
		cls +
		'" style="width:' +
		Math.min(p, 100) +
		'%"></div></div>';
	h +=
		'<div class="bb-lbl"><span>' +
		fmt(s.currentMonthCost) +
		' ' +
		t('al.spent') +
		'</span><span>' +
		fmt(s.threshold.remaining) +
		' ' +
		t('al.remaining') +
		'</span></div>';
	h +=
		'<div style="margin-top:14px"><div class="ms"><span class="l">' +
		t('al.projection') +
		'</span><span class="v c">' +
		fmt(s.projectedMonthlyCost) +
		'</span></div>';
	h +=
		'<div class="ms"><span class="l">' +
		t('al.status') +
		'</span><span class="v"><span class="badge ' +
		(al === 'critical' ? 'badge-r' : al === 'warning' ? 'badge-y' : 'badge-g') +
		'">' +
		(al === 'critical' ? t('al.critical') : al === 'warning' ? t('al.warning') : t('al.normal')) +
		'</span></span></div></div></div></div>';
	h +=
		'<div class="g2" style="margin-top:16px"><div class="crd"><h3>' +
		ico('bell-ring') +
		' ' +
		t('al.notifications') +
		'</h3>';
	h +=
		'<div class="ib info" style="margin-bottom:12px"><h4>' +
		ico('monitor') +
		' ' +
		t('al.macosTitle') +
		'</h4><p>' +
		t('al.macosDesc') +
		'</p></div>';
	h +=
		'<div class="fg"><label>' +
		t('al.slackLabel') +
		'</label><input type="url" id="cfg-slack" value="' +
		(w.config?.slackWebhookUrl || '') +
		'" placeholder="https://hooks.slack.com/services/..."></div>';
	h +=
		'<button class="btn btn-p" onclick="saveSlack()">' +
		ico('send') +
		' ' +
		t('al.saveWebhook') +
		'</button>';
	h += '<div id="slack-ts" style="margin-top:10px"></div></div>';
	h += '<div class="crd"><h3>' + ico('activity') + ' ' + t('al.daemon') + '</h3>';
	h +=
		'<div class="ib action" style="margin-bottom:0"><h4>' +
		ico('zap') +
		' ' +
		t('al.daemonActive') +
		'</h4>';
	h += '<p>' + t('al.daemonDesc') + '</p>';
	h +=
		'<div style="margin-top:12px"><div class="ms"><span class="l">' +
		t('al.realtimeCost') +
		'</span><span class="v c">$' +
		(w.cost?.toFixed(2) || '0.00') +
		'</span></div>';
	h +=
		'<div class="ms"><span class="l">' +
		t('al.alertLevel') +
		'</span><span class="v"><span class="badge ' +
		(w.alertLevel === 'critical' ? 'badge-r' : w.alertLevel === 'warning' ? 'badge-y' : 'badge-g') +
		'">' +
		(w.alertLevel || 'normal').toUpperCase() +
		'</span></span></div>';
	h +=
		'<div class="ms"><span class="l">' +
		t('al.transport') +
		'</span><span class="v">SSE (Server-Sent Events)</span></div></div></div></div></div>';
	document.getElementById('al-content').innerHTML = h;
	lucide.createIcons();
}
async function saveThresholds() {
	const b = {
		monthlyLimit: +document.getElementById('cfg-lim').value,
		warningPercent: +document.getElementById('cfg-w').value,
		criticalPercent: +document.getElementById('cfg-c').value,
	};
	await fetch(API + '/api/thresholds', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(b),
	});
	document.getElementById('ts').innerHTML =
		'<span class="badge badge-g">' + t('al.saved') + '</span>';
	setTimeout(() => {
		document.getElementById('ts').innerHTML = '';
	}, 2500);
	loadAlerts();
}
async function saveSlack() {
	const url = document.getElementById('cfg-slack').value.trim();
	await fetch(API + '/api/watcher/config', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ slackWebhookUrl: url }),
	});
	document.getElementById('slack-ts').innerHTML =
		'<span class="badge badge-g">' +
		(url ? t('al.webhookSaved') : t('al.webhookRemoved')) +
		'</span>';
	setTimeout(() => {
		document.getElementById('slack-ts').innerHTML = '';
	}, 2500);
}

async function loadManagement() {
	skel('mg-content');
	const [daily, proj] = await Promise.all([api('/api/daily'), api('/api/projects')]);
	const costs = daily.daily.map((d) => d.totalCost);
	const avg = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
	const mx = costs.length ? Math.max(...costs) : 0;
	const tI = daily.daily.reduce((a, d) => a + d.inputTokens, 0);
	const tO = daily.daily.reduce((a, d) => a + d.outputTokens, 0);
	let h = head('settings-2', t('mgmt.title'), t('mgmt.sub'));
	h +=
		'<div class="kpi-grid"><div class="kpi-card"><div class="top"><span class="lbl">' +
		t('mgmt.avgDaily') +
		'</span><div class="ico" style="background:#dbeafe;color:#3b82f6">' +
		ico('calculator') +
		'</div></div><div class="val">' +
		fmt(avg) +
		'</div></div>';
	h +=
		'<div class="kpi-card"><div class="top"><span class="lbl">' +
		t('mgmt.mostExpDay') +
		'</span><div class="ico" style="background:#fee2e2;color:#ef4444">' +
		ico('flame') +
		'</div></div><div class="val">' +
		fmt(mx) +
		'</div></div>';
	h +=
		'<div class="kpi-card"><div class="top"><span class="lbl">' +
		t('mgmt.totalInput') +
		'</span><div class="ico" style="background:#d1fae5;color:#10b981">' +
		ico('arrow-down-right') +
		'</div></div><div class="val">' +
		fmtK(tI) +
		'</div></div>';
	h +=
		'<div class="kpi-card"><div class="top"><span class="lbl">' +
		t('mgmt.totalOutput') +
		'</span><div class="ico" style="background:#fef3c7;color:#f59e0b">' +
		ico('arrow-up-right') +
		'</div></div><div class="val">' +
		fmtK(tO) +
		'</div></div></div>';
	h +=
		'<div class="g2"><div class="crd"><h3>' +
		ico('trending-up') +
		' ' +
		t('mgmt.trend') +
		'</h3><canvas id="ct"></canvas></div>';
	h +=
		'<div class="crd"><h3>' +
		ico('pie-chart') +
		' ' +
		t('mgmt.inputOutput') +
		'</h3><canvas id="cio"></canvas></div></div>';
	h +=
		'<div class="crd"><h3>' +
		ico('trophy') +
		' ' +
		t('mgmt.topProjects') +
		'</h3><div class="tw">' +
		tbl(
			['#', t('th.project'), t('th.cost'), t('th.tokens'), t('th.days')],
			proj.projects
				.slice(0, 10)
				.map((p, i) => [
					'#' + (i + 1),
					p.name,
					fmt(p.totalCost),
					fmtK(p.totalTokens),
					p.activeDays,
				]),
		) +
		'</div></div>';
	document.getElementById('mg-content').innerHTML = h;
	lucide.createIcons();
	const ma = costs.map((_, i) => {
		const s = Math.max(0, i - 6);
		const sl = costs.slice(s, i + 1);
		return sl.reduce((a, b) => a + b, 0) / sl.length;
	});
	dc('ct');
	charts.ct = new Chart(document.getElementById('ct'), {
		type: 'line',
		data: {
			labels: daily.daily.map((d) => d.date.slice(5)),
			datasets: [
				{
					label: t('mgmt.chartDaily'),
					data: costs,
					borderColor: 'rgba(124,58,237,.25)',
					backgroundColor: 'rgba(124,58,237,.04)',
					fill: true,
					tension: 0.3,
					pointRadius: 0,
				},
				{
					label: t('mgmt.chartAvg7d'),
					data: ma,
					borderColor: '#7c3aed',
					borderWidth: 2.5,
					tension: 0.4,
					pointRadius: 0,
				},
			],
		},
		options: {
			responsive: true,
			scales: {
				y: { beginAtZero: true, grid: { color: '#f4f4f5' }, ticks: { callback: (v) => '$' + v } },
				x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
			},
			plugins: { legend: { position: 'bottom' } },
		},
	});
	const cC = daily.daily.reduce((a, d) => a + d.cacheCreationTokens, 0),
		cR = daily.daily.reduce((a, d) => a + d.cacheReadTokens, 0);
	dc('cio');
	charts.cio = new Chart(document.getElementById('cio'), {
		type: 'doughnut',
		data: {
			labels: [t('chart.input'), t('chart.output'), t('chart.cacheCreate'), t('chart.cacheRead')],
			datasets: [
				{
					data: [tI, tO, cC, cR],
					backgroundColor: ['#7c3aed', '#3b82f6', '#14b8a6', '#f59e0b'],
					borderWidth: 3,
					borderColor: '#fff',
				},
			],
		},
		options: { responsive: true, cutout: '60%', plugins: { legend: { position: 'bottom' } } },
	});
}

async function loadInsights() {
	skel('in-content');
	const data = await api('/api/insights?lang=' + getLang());
	const el = document.getElementById('in-content');
	if (!data || data.error) {
		el.innerHTML =
			head('sparkles', t('ins.title'), '') +
			'<div class="ib info"><h4>' +
			t('ins.noData') +
			'</h4><p>' +
			t('ins.noDataDesc') +
			'</p></div>';
		return;
	}
	let h = head('sparkles', t('ins.title'), t('ins.sub'));
	h += '<div class="kpi-grid">';
	h +=
		'<div class="kpi-card"><div class="top"><span class="lbl">' +
		t('ins.totalCost') +
		'</span><div class="ico" style="background:#fee2e2;color:#ef4444">' +
		ico('dollar-sign') +
		'</div></div><div class="val">' +
		fmt(data.totalCost) +
		'</div><div class="sub">' +
		t('kpi.days', { n: data.totalDays }) +
		'</div></div>';
	h +=
		'<div class="kpi-card"><div class="top"><span class="lbl">' +
		t('ins.mostExpModel') +
		'</span><div class="ico" style="background:#fef3c7;color:#f59e0b">' +
		ico('alert-circle') +
		'</div></div><div class="val">' +
		sm(data.topModel.name) +
		'</div><div class="sub">' +
		fmt(data.topModel.cost) +
		' (' +
		fmtP(data.topModel.pct) +
		')</div></div>';
	h +=
		'<div class="kpi-card"><div class="top"><span class="lbl">' +
		t('ins.avgDaily') +
		'</span><div class="ico" style="background:#dbeafe;color:#3b82f6">' +
		ico('calculator') +
		'</div></div><div class="val">' +
		fmt(data.avgDaily) +
		'</div></div>';
	h +=
		'<div class="kpi-card"><div class="top"><span class="lbl">' +
		t('ins.potentialSaving') +
		'</span><div class="ico" style="background:#d1fae5;color:#10b981">' +
		ico('piggy-bank') +
		'</div></div><div class="val" style="color:#10b981">' +
		fmt(data.potentialSaving) +
		'</div><div class="sub">' +
		t('ins.perMonth') +
		'</div></div></div>';
	h +=
		'<div class="ib cost"><h4>' +
		ico('file-text') +
		' ' +
		t('ins.diagnosis') +
		'</h4><p>' +
		data.diagnosis +
		'</p></div>';
	for (const a of data.actions) {
		h +=
			'<div class="ib action"><h4>' +
			ico('zap') +
			' ' +
			a.title +
			'</h4><p>' +
			a.description +
			'</p>';
		if (a.saving)
			h +=
				'<div style="margin-top:8px"><span class="tag tag-save">' +
				t('ins.estSaving') +
				a.saving +
				'</span></div>';
		if (a.steps && a.steps.length) {
			h += '<ol style="margin-top:10px">';
			for (const s of a.steps) h += '<li>' + s + '</li>';
			h += '</ol>';
		}
		if (a.risks)
			h +=
				'<div style="margin-top:10px"><span class="tag tag-risk">' +
				t('ins.risk') +
				'</span> ' +
				a.risks +
				'</div>';
		h += '</div>';
	}
	if (data.warnings.length) {
		h +=
			'<div class="ib risk"><h4>' + ico('alert-triangle') + ' ' + t('ins.warnings') + '</h4><ul>';
		for (const w of data.warnings) h += '<li>' + w + '</li>';
		h += '</ul></div>';
	}
	el.innerHTML = h;
	lucide.createIcons();
}

async function loadBreakdown() {
	skel('br-content');
	const [daily] = await Promise.all([api('/api/daily')]);

	const tI = daily.daily.reduce((a, d) => a + d.inputTokens, 0);
	const tO = daily.daily.reduce((a, d) => a + d.outputTokens, 0);
	const cC = daily.daily.reduce((a, d) => a + d.cacheCreationTokens, 0);
	const cR = daily.daily.reduce((a, d) => a + d.cacheReadTokens, 0);

	let h = head('help-circle', t('br.title'), t('br.sub'));

	h += '<div class="g2">';
	h += '<div class="crd full"><h3>' + ico('book-open') + ' ' + t('br.whatAreTokens') + '</h3>';
	h +=
		'<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;">';
	h +=
		'<div class="ib info" style="margin:0"><h4>' +
		ico('arrow-down-right') +
		' Input</h4><p>' +
		t('br.inputDesc') +
		'</p><div class="val" style="font-size:20px;font-weight:800;color:var(--accent-blue);margin-top:8px;">' +
		fmtK(tI) +
		'</div></div>';
	h +=
		'<div class="ib cost" style="margin:0"><h4>' +
		ico('arrow-up-right') +
		' Output</h4><p>' +
		t('br.outputDesc') +
		'</p><div class="val" style="font-size:20px;font-weight:800;color:var(--accent-amber);margin-top:8px;">' +
		fmtK(tO) +
		'</div></div>';
	h +=
		'<div class="ib action" style="margin:0"><h4>' +
		ico('database') +
		' Cache Read</h4><p>' +
		t('br.cacheReadDesc') +
		'</p><div class="val" style="font-size:20px;font-weight:800;color:var(--accent-emerald);margin-top:8px;">' +
		fmtK(cR) +
		'</div></div>';
	h +=
		'<div class="ib risk" style="margin:0"><h4>' +
		ico('zap') +
		' Cache Create</h4><p>' +
		t('br.cacheCreateDesc') +
		'</p><div class="val" style="font-size:20px;font-weight:800;color:var(--accent-rose);margin-top:8px;">' +
		fmtK(cC) +
		'</div></div>';
	h += '</div></div>';

	h +=
		'<div class="crd full" style="margin-top:16px"><h3>' +
		ico('cpu') +
		' ' +
		t('br.sourcesTitle') +
		'</h3>';
	h +=
		'<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:16px;">';
	h +=
		'<div class="ib" style="margin:0;border-top:4px solid #7c3aed"><h4>' +
		ico('messages-square') +
		' ' +
		t('br.chatContext') +
		'</h4><p>' +
		t('br.chatContextDesc') +
		'</p></div>';
	h +=
		'<div class="ib" style="margin:0;border-top:4px solid #f43f5e"><h4>' +
		ico('blocks') +
		' ' +
		t('br.mcpTools') +
		'</h4><p>' +
		t('br.mcpToolsDesc') +
		'</p></div>';
	h +=
		'<div class="ib" style="margin:0;border-top:4px solid #06b6d4"><h4>' +
		ico('file-code') +
		' ' +
		t('br.largeFiles') +
		'</h4><p>' +
		t('br.largeFilesDesc') +
		'</p></div>';
	h += '</div></div></div>';

	document.getElementById('br-content').innerHTML = h;
	lucide.createIcons();
}

loadOverview();
