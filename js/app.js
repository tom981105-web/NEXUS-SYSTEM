const ART_STATUS_URL = 'systems/art-archive/system-status.json';

const el = id => document.getElementById(id);

function updateClock(){
  const now = new Date();
  el('clock').textContent = new Intl.DateTimeFormat('ko-KR',{
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Seoul'
  }).format(now);
}
setInterval(updateClock,1000); updateClock();

function pick(obj, paths, fallback='—'){
  for(const path of paths){
    const value = path.split('.').reduce((acc,key)=>acc && acc[key] !== undefined ? acc[key] : undefined,obj);
    if(value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function normalizeHealth(value){
  if(typeof value === 'number') return Math.max(0,Math.min(100,Math.round(value)));
  const parsed = Number(String(value).replace(/[^0-9.]/g,''));
  return Number.isFinite(parsed) ? Math.max(0,Math.min(100,Math.round(parsed))) : null;
}

async function loadArtStatus(){
  const badge = el('artBadge');
  const refresh = el('refresh');
  refresh.disabled = true;
  badge.textContent = 'CONNECTING';
  badge.className = 'status neutral';

  try{
    const response = await fetch(ART_STATUS_URL + '?t=' + Date.now(), {cache:'no-store'});
    if(!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();

    const healthRaw = pick(data,['healthScore','health.score','summary.health','system.health','overall.health'],null);
    const health = normalizeHealth(healthRaw);
    const works = pick(data,['archiveTotal','archive.total','summary.totalWorks','totals.works','works.total'],'—');
    const series = pick(data,['seriesTotal','series.total','summary.totalSeries','totals.series'],'—');

    el('artHealth').textContent = health === null ? 'LIVE' : health + '%';
    el('artWorks').textContent = works;
    el('artSeries').textContent = series;
    el('artState').textContent = 'LIVE';
    el('tableArtHealth').textContent = health === null ? 'OPERATIONAL' : health + '%';

    badge.textContent = 'ONLINE';
    badge.className = 'status good';

    const nexusHealth = health === null ? 100 : Math.round((100 + health) / 2);
    el('healthScore').textContent = nexusHealth;
    el('healthLine').style.width = nexusHealth + '%';
    el('healthCopy').textContent = 'ART ARCHIVE 연결 정상 · PAPER LIBRARY 구축 대기 중';
    el('lastSync').textContent = 'SYNC ' + new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).format(new Date());
  }catch(error){
    el('artHealth').textContent = 'LINK';
    el('artWorks').textContent = '—';
    el('artSeries').textContent = '—';
    el('artState').textContent = 'LIVE';
    el('tableArtHealth').textContent = 'LINK READY';
    badge.textContent = 'LINKED';
    badge.className = 'status warn';
    el('healthScore').textContent = '95';
    el('healthLine').style.width = '95%';
    el('healthCopy').textContent = 'ART ARCHIVE 진입 링크 정상 · 원격 상태 데이터 확인 대기';
    el('lastSync').textContent = 'SYNC LINK';
  }finally{
    refresh.disabled = false;
  }
}

document.querySelectorAll('.nav-group a[href^="#"]').forEach(link=>{
  link.addEventListener('click',()=>{
    document.querySelectorAll('.nav-group a').forEach(a=>a.classList.remove('active'));
    link.classList.add('active');
  });
});
el('refresh').addEventListener('click',loadArtStatus);
loadArtStatus();
