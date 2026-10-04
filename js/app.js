const ART_STATUS_URL = 'systems/art-archive/system-status.json';
const ART_AUTOMATION_URL = 'https://raw.githubusercontent.com/tom981105-web/art-archive/main/automation-status.json';
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
    const [statusResponse, automationResponse] = await Promise.all([
      fetch(ART_STATUS_URL + '?t=' + Date.now(), {cache:'no-store'}),
      fetch(ART_AUTOMATION_URL + '?t=' + Date.now(), {cache:'no-store'})
    ]);
    if(!statusResponse.ok) throw new Error('ART STATUS HTTP ' + statusResponse.status);
    if(!automationResponse.ok) throw new Error('ART AUTOMATION HTTP ' + automationResponse.status);

    const data = await statusResponse.json();
    const automation = await automationResponse.json();

    const diagnosis = data.automationDailyDiagnosis || automation.todayRunHealth || {};
    const success = Number(diagnosis.success || 0);
    const failed = Number(diagnosis.failed || 0);
    const stalled = Number(diagnosis.stalled || 0);
    const missed = Number(diagnosis.missed || 0);
    const running = Number(diagnosis.running || 0);
    const due = success + failed + stalled + missed + running;
    const health = due > 0 ? Math.round((success / due) * 100) : 100;

    const validSeries = (automation.series || []).filter(item =>
      item && item.name !== '자동화 상태' && Number(item.totalCount || 0) > 0
    );
    const works = validSeries.reduce((sum,item)=>sum + Number(item.totalCount || 0),0);
    const series = validSeries.length;

    el('artHealth').textContent = health + '%';
    el('artWorks').textContent = works.toLocaleString('ko-KR');
    el('artSeries').textContent = series.toLocaleString('ko-KR');
    el('artState').textContent = 'LIVE';
    el('tableArtHealth').textContent = health + '%';

    const hasIssue = failed > 0 || stalled > 0 || missed > 0 || data.overallStatus === 'error';
    badge.textContent = hasIssue ? 'ATTENTION' : 'ONLINE';
    badge.className = hasIssue ? 'status warn' : 'status good';

    const paperHealth = normalizeHealth((el('paperHealth').textContent || '').replace('%',''));
    const nexusHealth = paperHealth === null ? health : Math.round((health + paperHealth) / 2);
    el('healthScore').textContent = nexusHealth;
    el('healthLine').style.width = nexusHealth + '%';
    el('healthCopy').textContent = hasIssue
      ? 'ART 자동화 점검 필요 · PAPER LIBRARY 연결 정상'
      : 'ART ARCHIVE · PAPER LIBRARY 연결 정상';
    el('lastSync').textContent = 'SYNC ' + new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).format(new Date());

    return health;
  }catch(error){
    console.error('ART status load failed:', error);
    el('artHealth').textContent = 'LINK';
    el('artWorks').textContent = '—';
    el('artSeries').textContent = '—';
    el('artState').textContent = 'LIVE';
    el('tableArtHealth').textContent = 'LINK READY';
    badge.textContent = 'LINKED';
    badge.className = 'status warn';
    el('healthCopy').textContent = 'ART ARCHIVE 상태 데이터 연결 확인 필요';
    el('lastSync').textContent = 'SYNC LINK';
    return null;
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
  const values=[art,paper].filter(v=>typeof v==='number'&&Number.isFinite(v));
  const nexusHealth=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;
  el('healthScore').textContent=nexusHealth;
  el('healthLine').style.width=nexusHealth+'%';
  el('onlineCount').textContent='02';
  el('standbyCount').textContent='00';
}
el('refresh').addEventListener('click',refreshAll);
refreshAll();
