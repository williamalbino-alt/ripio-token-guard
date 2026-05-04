/* Core helpers & navigation */
const API='',charts={};
const C=['#7c3aed','#3b82f6','#14b8a6','#f59e0b','#f43f5e','#10b981','#f97316','#6366f1','#ec4899','#06b6d4'];
const fmt=n=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtK=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':n.toString();
const fmtP=n=>n.toFixed(1)+'%';
const fmtBytes=b=>{if(b>=1073741824)return(b/1073741824).toFixed(1)+' GB';if(b>=1048576)return(b/1048576).toFixed(0)+' MB';if(b>=1024)return(b/1024).toFixed(0)+' KB';return b+' B';};
const sm=m=>m.replace('claude-','').replace(/-2025\d*/g,'');
function dc(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function tbl(h,rows){
  let s='<table class="dt"><thead><tr>'+h.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>';
  s+=rows.map(r=>'<tr>'+r.map((c,i)=>'<td class="'+(i>0?'n ':'')+((/[Cc]ust|[Cc]ost/.test(h[i]))?'c':'')+'">'+c+'</td>').join('')+'</tr>').join('');
  return s+'</tbody></table>';
}
function openModal(t,c){document.getElementById('mo-body').innerHTML='<h3>'+t+'</h3>'+c;document.getElementById('modal').classList.add('open');lucide.createIcons();}
function closeModal(){document.getElementById('modal').classList.remove('open');}
function ico(n){return '<i data-lucide="'+n+'"></i>';}
function head(icon,title,sub){return '<div class="page-head"><div class="ico">'+ico(icon)+'</div><div><h2>'+title+'</h2><p>'+sub+'</p></div><div class="head-actions"><span class="refresh-ts" id="refresh-ts"></span><button class="btn-download" onclick="downloadPage()" title="'+t('core.downloadReport')+'"><i data-lucide="download"></i></button><button class="btn-refresh" onclick="refreshPage()" title="Refresh"><i data-lucide="refresh-cw"></i></button></div></div>';}
let _lastRefresh=Date.now();
function refreshPage(){invalidateCache();const btn=document.querySelector('.btn-refresh');if(btn)btn.classList.add('spinning');const active=document.querySelector('.nav-btn.active');if(active)active.click();_lastRefresh=Date.now();updateRefreshTs();setTimeout(()=>{const b=document.querySelector('.btn-refresh');if(b)b.classList.remove('spinning');},800);}
function updateRefreshTs(){const el=document.getElementById('refresh-ts');if(!el)return;const s=Math.floor((Date.now()-_lastRefresh)/1000);if(s<5)el.textContent=getLang()==='es'?'Justo ahora':'Agora mesmo';else if(s<60)el.textContent=s+'s';else el.textContent=Math.floor(s/60)+'m';}
setInterval(updateRefreshTs,5000);

// ─── Spinner Loader (replaces skeleton) ───────────────────
function skel(id){
  document.getElementById(id).innerHTML=
    '<div class="spinner-wrap">'+
    '<div class="spinner"></div>'+
    '<span class="spinner-text">'+t('core.loading')+'</span>'+
    '</div>';
}

// ─── API with LocalStorage Cache ──────────────────────────
const CACHE_TTL=60000; // 1 min TTL
const _cacheVer={};    // version counter per endpoint to detect stale data

async function api(url){
  const key='tg_'+url;
  // Try cache first
  try{
    const cached=JSON.parse(localStorage.getItem(key));
    if(cached && (Date.now()-cached.ts)<CACHE_TTL){
      // Return cached data immediately, but refresh in background
      refreshInBackground(url,key,cached.ts);
      return cached.data;
    }
  }catch{}
  // No cache or expired: fetch fresh
  const data=await(await fetch(API+url)).json();
  localStorage.setItem(key,JSON.stringify({data,ts:Date.now()}));
  return data;
}

async function refreshInBackground(url,key,cachedTs){
  // Only refresh if not already refreshing
  if(_cacheVer[key])return;
  _cacheVer[key]=true;
  try{
    const data=await(await fetch(API+url)).json();
    // Check if data actually changed (compare lastUpdated or stringify)
    const freshStr=JSON.stringify(data);
    const cachedStr=JSON.stringify(JSON.parse(localStorage.getItem(key))?.data);
    if(freshStr!==cachedStr){
      localStorage.setItem(key,JSON.stringify({data,ts:Date.now()}));
      // If overview is showing, auto-refresh it
      const ov=document.getElementById('page-overview');
      if(ov&&ov.classList.contains('active')&&url==='/api/summary'){loadOverview();}
    }
  }catch{}
  _cacheVer[key]=false;
}

// Force-refresh: invalidate cache
function invalidateCache(url){
  if(url){localStorage.removeItem('tg_'+url);return;}
  // Invalidate all
  Object.keys(localStorage).filter(k=>k.startsWith('tg_')).forEach(k=>localStorage.removeItem(k));
}

// Nav
document.querySelectorAll('.nav-btn').forEach(b=>{b.addEventListener('click',()=>{
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  b.classList.add('active');const pg=b.dataset.page;
  document.getElementById('page-'+pg).classList.add('active');
  ({overview:loadOverview,daily:loadDaily,monthly:loadMonthly,projects:loadProjects,
    sessions:loadSessions,models:loadModels,alerts:loadAlerts,management:loadManagement,
    breakdown:loadBreakdown,insights:loadInsights})[pg]();
});});

// Chart defaults
Chart.defaults.font.family='Inter';Chart.defaults.font.size=11;
Chart.defaults.plugins.legend.labels.usePointStyle=true;
Chart.defaults.plugins.legend.labels.padding=14;
Chart.defaults.elements.bar.borderRadius=6;
Chart.defaults.elements.bar.borderSkipped=false;

// SSE: Live updates from FSEvents watcher
let _sseStatus=null;
function connectSSE(){
  const es=new EventSource('/api/events');
  es.onmessage=function(e){try{
    const ev=JSON.parse(e.data);
    if(ev.type==='cost_update'){
      // Invalidate caches and auto-refresh overview
      invalidateCache();
      const ov=document.getElementById('page-overview');
      if(ov&&ov.classList.contains('active'))loadOverview();
      showToast(t('core.costUpdated')+ev.data.currentCost.toFixed(2),'info');
    }
    if(ev.type==='alert'){
      showToast(t('core.alertPrefix')+ev.data.alertLevel.toUpperCase()+' — $'+ev.data.cost.toFixed(2),ev.data.alertLevel==='critical'?'danger':'warning');
    }
    _sseStatus='connected';
  }catch{}};
  es.onerror=function(){_sseStatus='reconnecting';setTimeout(()=>{es.close();connectSSE();},5000);};
}
connectSSE();

// Toast notification
function showToast(msg,type){
  const t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;animation:pageIn .3s ease;box-shadow:0 8px 32px rgba(0,0,0,.15);max-width:380px;';
  if(type==='danger')t.style.cssText+='background:#fee2e2;color:#991b1b;border:1px solid #fecaca;';
  else if(type==='warning')t.style.cssText+='background:#fef3c7;color:#92400e;border:1px solid #fde68a;';
  else t.style.cssText+='background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;';
  t.textContent=msg;document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300);},4000);
}

// ─── Download Page as Self-contained HTML ─────────────────
async function downloadPage(){
  const btn=document.querySelector('.btn-download');
  if(btn){btn.classList.add('downloading');btn.style.pointerEvents='none';}
  
  // Create an overlay spinner
  const overlay = document.createElement('div');
  overlay.innerHTML = '<div class="spinner-wrap" style="background:rgba(255,255,255,0.9);position:fixed;inset:0;z-index:99999;backdrop-filter:blur(4px);"><div class="spinner"></div><span class="spinner-text" style="font-size:16px;">'+t('core.generatingReport')+'</span></div>';
  document.body.appendChild(overlay);
  
  // Yield to the browser to render the overlay
  await new Promise(r => setTimeout(r, 50));
  
  try{
    // 0. Temporarily prepare ALL pages to render at once (except settings)
    const pages = Array.from(document.querySelectorAll('.page'))
      .filter(p => p.id !== 'page-alerts' && p.id !== 'page-management');
    const originalStyles = pages.map(p => p.style.cssText);
    pages.forEach(p => {
      p.style.display = 'block';
      p.style.position = 'absolute';
      p.style.visibility = 'hidden';
      p.style.width = '100%';
    });

    // Wait for all sections to fetch their data and render
    await Promise.all([
      loadOverview(), loadDaily(), loadMonthly(), loadProjects(),
      loadSessions(), loadModels(), loadBreakdown(), loadInsights()
    ]);

    // 1. Convert all canvases to images
    const canvases=document.querySelectorAll('.page canvas');
    const canvasMap=new Map();
    canvases.forEach(c=>{
      try{
        const img=document.createElement('img');
        img.src=c.toDataURL('image/png');
        img.style.cssText='width:100%;max-height:'+c.style.maxHeight+';border-radius:8px;';
        canvasMap.set(c,img);
        c.parentNode.replaceChild(img,c);
      }catch{}
    });

    // 2. Get logo as data URI
    let logoDataUri='';
    try{
      const logoImg=document.querySelector('.nav-brand img');
      if(logoImg){
        const canvas=document.createElement('canvas');
        canvas.width=logoImg.naturalWidth||68;
        canvas.height=logoImg.naturalHeight||68;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(logoImg,0,0);
        logoDataUri=canvas.toDataURL('image/png');
      }
    }catch{}

    // 3. Collect all stylesheets as inline CSS
    let allCSS='';
    for(const sheet of document.styleSheets){
      try{
        for(const rule of sheet.cssRules)allCSS+=rule.cssText+'\n';
      }catch{}
    }

    // 4. Get ALL pages content sequentially
    let pageHTML='';
    pages.forEach(p => {
      pageHTML += '<div style="margin-bottom:60px;padding-bottom:40px;border-bottom:2px dashed #e4e4e7;">' + p.innerHTML + '</div>';
    });

    // 5. Generate timestamp and filename
    const now=new Date();
    const ts=now.toLocaleDateString(getLang()==='es'?'es-AR':'pt-BR',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const fileTs=now.toISOString().slice(0,16).replace(/[T:]/g,'-');
    const pageName='Full Report';
    const fileName='TokenGuard-'+pageName.replace(/[^a-zA-Z0-9]/g,'_')+'-'+fileTs+'.html';

    // 6. Build self-contained HTML
    const html=`<!DOCTYPE html>
<html lang="${getLang()}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Token Guard — ${pageName} — ${ts}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap">
<style>
${allCSS}
body{display:block;background:#f0eef6;}
.nav-rail,.mo,.btn-refresh,.btn-download,.head-actions .refresh-ts{display:none!important;}
.main{margin-left:0;padding:24px 32px;}
.page{display:block;animation:none;}
.report-header{display:flex;align-items:center;gap:16px;padding:20px 28px;margin-bottom:24px;
  background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:18px;color:#fff;
  box-shadow:0 8px 32px rgba(124,58,237,.25);}
.report-header img{width:42px;height:42px;border-radius:10px;background:#ffffff;padding:4px;box-shadow:0 2px 8px rgba(0,0,0,.15);}
.report-header .info{flex:1;}
.report-header h1{font-size:18px;font-weight:800;margin:0;}
.report-header p{font-size:12px;opacity:.8;margin:2px 0 0;}
.report-header .badge-report{background:rgba(255,255,255,.2);color:#fff;padding:4px 12px;border-radius:20px;
  font-size:10px;font-weight:700;letter-spacing:.3px;}
.report-footer{text-align:center;padding:24px;margin-top:32px;border-top:1px solid #e4e4e7;
  font-size:11px;color:#a1a1aa;}
.head-actions{display:none!important;}
</style>
</head>
<body>
<main class="main">
<div class="report-header">
  ${logoDataUri?'<img src="'+logoDataUri+'" alt="Token Guard">':''}
  <div class="info">
    <h1>Token Guard — FinOps Report</h1>
    <p>${pageName} · ${ts}</p>
  </div>
  <span class="badge-report">${t('core.readOnly')}</span>
</div>
<section class="page active" style="display:block;animation:none">
${pageHTML}
</section>
<div class="report-footer">
  Token Guard — FinOps Dashboard · ${t('core.generatedAt')} ${ts}<br>
  100% Offline · ${t('core.shareNote')}
</div>
</main>
</body>
</html>`;

    // 7. Download
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=fileName;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},100);

    // 8. Restore canvases
    canvasMap.forEach((img,canvas)=>{
      if(img.parentNode)img.parentNode.replaceChild(canvas,img);
    });

    // Revert pages to original styles
    pages.forEach((p, i) => {
      p.style.cssText = originalStyles[i];
    });

    // Re-render current page to restore chart interactivity
    const activeNav=document.querySelector('.nav-btn.active');
    if(activeNav)activeNav.click();

    showToast(t('core.downloadSuccess'),'info');
  }catch(err){
    showToast(t('core.downloadError'),'danger');
  }finally{
    if(overlay) overlay.remove();
    if(btn){btn.classList.remove('downloading');btn.style.pointerEvents='';}
  }
}
