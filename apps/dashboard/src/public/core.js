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
function head(icon,title,sub){return '<div class="page-head"><div class="ico">'+ico(icon)+'</div><div><h2>'+title+'</h2><p>'+sub+'</p></div><div class="head-actions"><span class="refresh-ts" id="refresh-ts"></span><button class="btn-refresh" onclick="refreshPage()" title="Refresh"><i data-lucide="refresh-cw"></i></button></div></div>';}
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
    insights:loadInsights})[pg]();
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
