/* ═══ i18n — Internationalization Module ═══ */
const LANGS={
es:{
// Nav
'nav.dashboards':'Dashboards','nav.overview':'Overview','nav.daily':'Reporte Diario','nav.monthly':'Reporte Mensual',
'nav.analysis':'Análisis','nav.projects':'Proyectos','nav.sessions':'Sesiones','nav.models':'Modelos',
'nav.mgmt_label':'Gestión','nav.alerts':'Alertas y Límites','nav.tokenMgmt':'Gestión de Tokens',
'nav.insights':'Resumen Inteligente','nav.footer':'100% Offline · Sin Telemetría',
// Overview
'ov.title':'Overview','ov.sub':'Visión general de costos y consumo de tokens',
'alert.critical':'¡ALERTA CRÍTICO: Gasto mensual alcanzó el {pct} del límite!',
'alert.warning':'Atención: {pct} del límite.',
'kpi.totalCost':'Costo Total','kpi.today':'Costo Hoy','kpi.monthSpend':'Gasto del Mes',
'kpi.projection':'Proyección Mensual','kpi.topProject':'Proyecto Top','kpi.logSize':'Tamaño de Logs',
'kpi.days':'{n} días','kpi.models':'{n} modelos','kpi.ofLimit':'{pct} del límite',
'kpi.remaining':'Restante: {v}','kpi.clickDetails':'Click para detalles',
'chart.dailyCost':'Costo Diario (30d)','chart.costByModel':'Costo por Modelo',
'chart.tokensByType':'Tokens por Tipo (30d)','chart.cost':'Costo',
'chart.input':'Input','chart.output':'Output','chart.cacheCreate':'Cache Create','chart.cacheRead':'Cache Read',
// KPI Modals
'modal.totalCost':'Costo Total','modal.today':'Costo Hoy','modal.monthSpend':'Gasto del Mes',
'modal.projection':'Proyección Mensual','modal.projects':'Proyectos: Consumo','modal.logSize':'Tamaño de Logs',
'modal.avgDay':'Promedio/día','modal.models':'Modelos','modal.proj_label':'Proyección',
'modal.currentSpend':'Gasto Actual','modal.remaining':'Restante','modal.totalSize':'Tamaño Total',
'modal.bytes':'Bytes','modal.logInfo':'ℹ️ Estos logs NO afectan los tokens. Son registros históricos que Claude graba <i>después</i> de cada interacción. Claude nunca relee estos archivos. Solo este dashboard los lee para calcular costos.',
'modal.projWarning':'<b>Atención:</b> Tokens clasificados como "API / MCP / Extensiones" pueden indicar consumo por herramientas externas, MCP servers, extensiones de VS Code, o sesiones sin proyecto asociado. Investigue para evitar costos ocultos.',
'modal.projFooter':'Basado en el directorio raíz de cada proyecto (donde están .gitignore, package.json, etc.)',
// Daily
'daily.title':'Reporte Diario','daily.sub':'Uso de tokens y costos agregados por fecha',
'daily.filter':'Filtrar','daily.chart':'Costo Diario','daily.details':'Detalle',
'th.date':'Fecha','th.input':'Input','th.output':'Output','th.cacheCreate':'Cache Create',
'th.cacheRead':'Cache Read','th.total':'Total','th.cost':'Costo','th.models':'Modelos',
// Monthly
'monthly.title':'Reporte Mensual','monthly.sub':'Uso agregado por mes',
'monthly.chart':'Costo Mensual','monthly.details':'Detalle','th.month':'Mes',
// Projects
'proj.title':'Proyectos','proj.sub':'Consumo agrupado por proyecto',
'proj.topChart':'Top Proyectos','proj.allTable':'Todos los Proyectos',
'th.project':'Proyecto','th.totalCost':'Costo Total','th.tokens':'Tokens','th.days':'Días',
// Sessions
'sess.title':'Sesiones','sess.sub':'Top 50 sesiones por costo',
'th.session':'Sesión','th.lastAct':'Última Activ.',
// Models
'mod.title':'Modelos','mod.sub':'Desglose por modelo Claude',
'mod.costChart':'Costo por Modelo','mod.tokenDist':'Distribución de Tokens','mod.details':'Detalle',
'th.model':'Modelo','th.pctCost':'% Costo',
// Alerts
'al.title':'Alertas y Límites','al.sub':'Configure thresholds, notificaciones e integraciones',
'al.configTitle':'Configuración de Límites','al.monthlyLimit':'Límite Mensual (USD)',
'al.warningPct':'Alerta Amarillo (%)','al.criticalPct':'Alerta Rojo (%)',
'al.saveBtn':'Guardar Límites','al.saved':'¡Guardado!',
'al.budgetStatus':'Status del Presupuesto','al.ofLimit':'del límite de {v}',
'al.spent':'gastado','al.remaining':'restante',
'al.projection':'Proyección','al.status':'Status',
'al.critical':'CRÍTICO','al.warning':'ATENCIÓN','al.normal':'NORMAL',
'al.notifications':'Notificaciones','al.macosTitle':'Notificaciones macOS',
'al.macosDesc':'Activadas automáticamente. Cuando se alcanza el threshold, aparece una notificación nativa en la pantalla de tu Mac.',
'al.slackLabel':'Slack Webhook URL (opcional)','al.saveWebhook':'Guardar Webhook',
'al.webhookSaved':'¡Webhook guardado!','al.webhookRemoved':'Webhook eliminado',
'al.daemon':'Daemon (FSEvents Watcher)','al.daemonActive':'Status: Activo',
'al.daemonDesc':'El watcher está monitoreando <code>~/.claude/projects/</code> en tiempo real vía FSEvents de macOS. Cuando Claude graba un nuevo log, el costo se recalcula instantáneamente.',
'al.realtimeCost':'Costo en tiempo real','al.alertLevel':'Nivel de alerta','al.transport':'Transporte',
// Management
'mgmt.title':'Gestión de Tokens','mgmt.sub':'Análisis avanzado y tendencias',
'mgmt.avgDaily':'Promedio Diario','mgmt.mostExpDay':'Día Más Caro',
'mgmt.totalInput':'Total Input','mgmt.totalOutput':'Total Output',
'mgmt.trend':'Tendencia (Promedio 7d)','mgmt.inputOutput':'Input vs Output',
'mgmt.topProjects':'Top Proyectos','mgmt.chartDaily':'Diario','mgmt.chartAvg7d':'Promedio 7d',
// Insights
'ins.title':'Resumen Inteligente','ins.sub':'Análisis enfocado en reducción de costos — acciones inmediatas',
'ins.noData':'Datos insuficientes','ins.noDataDesc':'Aún no hay datos suficientes para generar el análisis.',
'ins.totalCost':'Costo Total','ins.mostExpModel':'Modelo Más Caro','ins.avgDaily':'Promedio Diario',
'ins.potentialSaving':'Ahorro Potencial','ins.perMonth':'por mes','ins.diagnosis':'Diagnóstico de Costos',
'ins.estSaving':'Ahorro estimado: ','ins.risk':'Riesgo','ins.warnings':'Puntos de Atención',
// Core
'core.loading':'Cargando datos...','core.costUpdated':'Costo actualizado: $',
'core.alertPrefix':'ALERTA: ',
// Toast
'toast.langChanged':'Idioma cambiado a {lang}'
},
pt:{
// Nav
'nav.dashboards':'Dashboards','nav.overview':'Overview','nav.daily':'Relatório Diário','nav.monthly':'Relatório Mensal',
'nav.analysis':'Análise','nav.projects':'Projetos','nav.sessions':'Sessões','nav.models':'Modelos',
'nav.mgmt_label':'Gestão','nav.alerts':'Alertas & Limites','nav.tokenMgmt':'Gestão de Tokens',
'nav.insights':'Resumo Inteligente','nav.footer':'100% Offline · Sem Telemetria',
// Overview
'ov.title':'Overview','ov.sub':'Visão geral dos custos e consumo de tokens',
'alert.critical':'ALERTA CRÍTICO: Gasto mensal atingiu {pct} do limite!',
'alert.warning':'Atenção: {pct} do limite.',
'kpi.totalCost':'Custo Total','kpi.today':'Custo Hoje','kpi.monthSpend':'Gasto do Mês',
'kpi.projection':'Projeção Mensal','kpi.topProject':'Projeto Top','kpi.logSize':'Tamanho dos Logs',
'kpi.days':'{n} dias','kpi.models':'{n} modelos','kpi.ofLimit':'{pct} do limite',
'kpi.remaining':'Restante: {v}','kpi.clickDetails':'Clique para detalhes',
'chart.dailyCost':'Custo Diário (30d)','chart.costByModel':'Custo por Modelo',
'chart.tokensByType':'Tokens por Tipo (30d)','chart.cost':'Custo',
'chart.input':'Input','chart.output':'Output','chart.cacheCreate':'Cache Create','chart.cacheRead':'Cache Read',
// KPI Modals
'modal.totalCost':'Custo Total','modal.today':'Custo Hoje','modal.monthSpend':'Gasto do Mês',
'modal.projection':'Projeção Mensal','modal.projects':'Projetos: Consumo','modal.logSize':'Tamanho dos Logs',
'modal.avgDay':'Média/dia','modal.models':'Modelos','modal.proj_label':'Projeção',
'modal.currentSpend':'Gasto Atual','modal.remaining':'Restante','modal.totalSize':'Tamanho Total',
'modal.bytes':'Bytes','modal.logInfo':'ℹ️ Esses logs NÃO afetam os tokens. São registros históricos que o Claude grava <i>após</i> cada interação. O Claude nunca relê esses arquivos. Apenas esta dashboard os lê para calcular custos.',
'modal.projWarning':'<b>Atenção:</b> Tokens classificados como "API / MCP / Extensões" podem indicar consumo por ferramentas externas, MCP servers, extensões do VS Code, ou sessões sem projeto associado. Investigue para evitar custos ocultos.',
'modal.projFooter':'Baseado no diretório raiz de cada projeto (onde ficam .gitignore, package.json, etc.)',
// Daily
'daily.title':'Relatório Diário','daily.sub':'Uso de tokens e custos agregados por data',
'daily.filter':'Filtrar','daily.chart':'Custo Diário','daily.details':'Detalhamento',
'th.date':'Data','th.input':'Input','th.output':'Output','th.cacheCreate':'Cache Create',
'th.cacheRead':'Cache Read','th.total':'Total','th.cost':'Custo','th.models':'Modelos',
// Monthly
'monthly.title':'Relatório Mensal','monthly.sub':'Uso agregado por mês',
'monthly.chart':'Custo Mensal','monthly.details':'Detalhamento','th.month':'Mês',
// Projects
'proj.title':'Projetos','proj.sub':'Consumo agrupado por projeto',
'proj.topChart':'Top Projetos','proj.allTable':'Todos os Projetos',
'th.project':'Projeto','th.totalCost':'Custo Total','th.tokens':'Tokens','th.days':'Dias',
// Sessions
'sess.title':'Sessões','sess.sub':'Top 50 sessões por custo',
'th.session':'Sessão','th.lastAct':'Última Ativ.',
// Models
'mod.title':'Modelos','mod.sub':'Breakdown por modelo Claude',
'mod.costChart':'Custo por Modelo','mod.tokenDist':'Distribuição de Tokens','mod.details':'Detalhamento',
'th.model':'Modelo','th.pctCost':'% Custo',
// Alerts
'al.title':'Alertas & Limites','al.sub':'Configure thresholds, notificações e integrações',
'al.configTitle':'Configuração de Limites','al.monthlyLimit':'Limite Mensal (USD)',
'al.warningPct':'Alerta Amarelo (%)','al.criticalPct':'Alerta Vermelho (%)',
'al.saveBtn':'Salvar Limites','al.saved':'Salvo!',
'al.budgetStatus':'Status do Orçamento','al.ofLimit':'do limite de {v}',
'al.spent':'gasto','al.remaining':'restante',
'al.projection':'Projeção','al.status':'Status',
'al.critical':'CRÍTICO','al.warning':'ATENÇÃO','al.normal':'NORMAL',
'al.notifications':'Notificações','al.macosTitle':'Notificações macOS',
'al.macosDesc':'Ativadas automaticamente. Quando o threshold é atingido, uma notificação nativa aparece na tela do seu Mac.',
'al.slackLabel':'Slack Webhook URL (opcional)','al.saveWebhook':'Salvar Webhook',
'al.webhookSaved':'Webhook salvo!','al.webhookRemoved':'Webhook removido',
'al.daemon':'Daemon (FSEvents Watcher)','al.daemonActive':'Status: Ativo',
'al.daemonDesc':'O watcher está monitorando <code>~/.claude/projects/</code> em tempo real via FSEvents do macOS. Quando o Claude grava um novo log, o custo é recalculado instantaneamente.',
'al.realtimeCost':'Custo em tempo real','al.alertLevel':'Nível de alerta','al.transport':'Transporte',
// Management
'mgmt.title':'Gestão de Tokens','mgmt.sub':'Análise avançada e tendências',
'mgmt.avgDaily':'Média Diária','mgmt.mostExpDay':'Dia Mais Caro',
'mgmt.totalInput':'Total Input','mgmt.totalOutput':'Total Output',
'mgmt.trend':'Tendência (Média 7d)','mgmt.inputOutput':'Input vs Output',
'mgmt.topProjects':'Top Projetos','mgmt.chartDaily':'Diário','mgmt.chartAvg7d':'Média 7d',
// Insights
'ins.title':'Resumo Inteligente','ins.sub':'Análise focada em redução de custos — ações imediatas',
'ins.noData':'Dados insuficientes','ins.noDataDesc':'Ainda não há dados suficientes para gerar a análise.',
'ins.totalCost':'Custo Total','ins.mostExpModel':'Modelo Mais Caro','ins.avgDaily':'Média Diária',
'ins.potentialSaving':'Economia Potencial','ins.perMonth':'por mês','ins.diagnosis':'Diagnóstico de Custos',
'ins.estSaving':'Economia estimada: ','ins.risk':'Risco','ins.warnings':'Pontos de Atenção',
// Core
'core.loading':'Carregando dados...','core.costUpdated':'Custo atualizado: $',
'core.alertPrefix':'ALERTA: ',
// Toast
'toast.langChanged':'Idioma alterado para {lang}'
}
};

let _lang=localStorage.getItem('tg_lang')||'es';

function t(key,params){
  let s=LANGS[_lang]?.[key]||LANGS['es']?.[key]||key;
  if(params)for(const[k,v]of Object.entries(params))s=s.replaceAll('{'+k+'}',v);
  return s;
}
function getLang(){return _lang;}
function setLang(lang){
  _lang=lang;localStorage.setItem('tg_lang',lang);
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{el.innerHTML=t(el.dataset.i18nHtml);});
  updateLangToggle();
  const active=document.querySelector('.nav-btn.active');
  if(active)active.click();
  showToast(t('toast.langChanged',{lang:lang==='es'?'Español 🇦🇷':'Português 🇧🇷'}),'info');
}
function updateLangToggle(){
  const el=document.getElementById('lang-toggle');
  if(!el)return;
  el.classList.toggle('is-pt',_lang==='pt');
}
// Init on load
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{el.innerHTML=t(el.dataset.i18nHtml);});
  updateLangToggle();
});
