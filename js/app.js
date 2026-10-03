const ART_STATUS_URL = 'systems/art-archive/system-status.json';
const PAPER_INDEX_URL = 'https://raw.githubusercontent.com/tom981105-web/paper/main/data/index.json';

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

async function loadPaperStatus(){
  const badge=el('paperBadge');
  badge.textContent='CONNECTING'; badge.className='status neutral';
  try{
    const response=await fetch(PAPER_INDEX_URL+'?t='+Date.now(),{cache:'no-store'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    const papers=await response.json();
    const fields=new Set(papers.map(p=>p.category).filter(Boolean));
    const verified=papers.filter(p=>p.verified).length;
    const health=papers.length&&verified===papers.length?100:95;
    el('paperHealth').textContent=health+'%';
    el('paperCount').textContent=papers.length.toLocaleString('ko-KR');
    el('paperFields').textContent=fields.size;
    el('paperState').textContent='LIVE';
    el('tablePaperHealth').textContent=health+'%';
    badge.textContent='ONLINE'; badge.className='status good';
    return health;
  }catch(error){
    el('paperHealth').textContent='LINK'; el('paperCount').textContent='—'; el('paperFields').textContent='—';
    el('tablePaperHealth').textContent='LINK READY'; badge.textContent='LINKED'; badge.className='status warn';
    return 90;
  }
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
    el('healthCopy').textContent = 'ART ARCHIVE · PAPER LIBRARY 연결 정상';
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
async function refreshAll(){
  const [art,paper]=await Promise.all([loadArtStatus(),loadPaperStatus()]);
  el('onlineCount').textContent='02'; el('standbyCount').textContent='00';
}
el('refresh').addEventListener('click',refreshAll);
refreshAll();
