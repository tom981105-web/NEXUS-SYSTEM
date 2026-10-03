const eventClass=level=>level==='error'||level==='failure'?'bad':level==='warning'||level==='cancelled'?'warn':level==='success'?'good':'neutral';
const eventFmt=v=>v?new Date(v).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
let systemEventsCache=[];
let activeEventFilter='all';

function renderEventRows(){
  const log=document.querySelector('#eventLog');if(!log)return;
  const filtered=systemEventsCache.filter(e=>{
    if(activeEventFilter==='all')return true;
    if(activeEventFilter==='error')return e.level==='error'||e.level==='failure';
    if(activeEventFilter==='busy')return e.status==='skipped'||e.level==='busy';
    return e.service===activeEventFilter;
  });
  log.innerHTML=filtered.slice(0,30).map(e=>`<div class="event"><time>${eventFmt(e.at)}</time><span class="tag">${e.service||'SYSTEM'}</span><b>${e.title||e.status||'Event'}<small style="display:block;color:#65706d;font-weight:400;margin-top:4px">${e.message||''}</small></b><em class="${eventClass(e.level)}">${String(e.status||e.level||'INFO').toUpperCase()}</em></div>`).join('')||'<p class="muted">조건에 맞는 시스템 이벤트가 없습니다.</p>';
}

function renderEventStats(events){
  const now=Date.now(),cutoff=now-24*60*60*1000;
  const normalized=events.map(e=>(e.status==='skipped'?Object.assign({},e,{level:'info'}):e));
  const recent=normalized.filter(e=>new Date(e.at).getTime()>=cutoff);
  const errors=recent.filter(e=>e.level==='error'||e.level==='failure');
  const warnings=recent.filter(e=>e.level==='warning'||e.level==='cancelled');
  const incidents=normalized.filter(e=>e.level==='error'||e.level==='failure'||e.level==='warning'||e.level==='cancelled');
  const recoveries=normalized.filter(e=>e.level==='success');
  const err=document.querySelector('#eventErrors24h'),warn=document.querySelector('#eventWarnings24h'),lastI=document.querySelector('#eventLastIncident'),lastR=document.querySelector('#eventLastRecovery'),summary=document.querySelector('#eventStateSummary');
  if(err)err.textContent=errors.length;
  if(warn)warn.textContent=warnings.length;
  if(lastI)lastI.textContent=incidents[0]?eventFmt(incidents[0].at):'없음';
  if(lastR)lastR.textContent=recoveries[0]?eventFmt(recoveries[0].at):'없음';

  const latestByService={};
  for(const e of normalized){if(!latestByService[e.service])latestByService[e.service]=e}
  const activeIssues=Object.values(latestByService).filter(e=>e.level==='error'||e.level==='failure'||e.level==='warning'||e.level==='cancelled');
  if(summary){
    if(activeIssues.some(e=>e.level==='error'||e.level==='failure')){summary.textContent='현재 장애 상태 감지';summary.className='muted event-state-bad'}
    else if(activeIssues.length){summary.textContent='현재 경고 상태 감지';summary.className='muted event-state-warn'}
    else{summary.textContent='현재 기록 기준 복구 상태';summary.className='muted event-state-ok'}
  }
}

async function loadSystemEvents(){
  const log=document.querySelector('#eventLog'),sync=document.querySelector('#eventSync');
  if(!log||!sync)return;
  try{
    const [er,sr]=await Promise.all([
      fetch('system-events.json?ts='+Date.now(),{cache:'no-store'}),
      fetch('system-status.json?ts='+Date.now(),{cache:'no-store'})
    ]);
    const local=er.ok?await er.json():{events:[]};
    const status=sr.ok?await sr.json():{};
    const deploy=((status.githubDeploy&&status.githubDeploy.recentRuns)||[]).map((x,i)=>({
      at:x.updated_at||x.created_at,
      service:'GitHub Pages',
      level:x.conclusion==='success'?'success':x.conclusion==='cancelled'?(i===0?'warning':'info'):x.status==='completed'?'error':'info',
      status:x.conclusion==='cancelled'&&i>0?'superseded':(x.conclusion||x.status),
      title:x.conclusion==='cancelled'&&i>0?'Deploy SUPERSEDED':'Deploy '+String(x.conclusion||x.status).toUpperCase(),
      message:x.message||x.head_sha
    }));
    const localEvents=(local.events||[]).map(e=>(e.status==='skipped'?Object.assign({},e,{level:'info'}):e));
    systemEventsCache=[...localEvents,...deploy].sort((a,b)=>new Date(b.at)-new Date(a.at));
    sync.textContent='EVENT SYNC '+eventFmt(local.updatedAt||new Date());
    renderEventStats(systemEventsCache);
    renderEventRows();
  }catch(e){
    sync.textContent='EVENT DATA ERROR';
    log.innerHTML='<p class="muted">이벤트 이력을 불러오지 못했습니다.</p>';
  }
}

document.addEventListener('click',e=>{
  const btn=e.target.closest('.event-filter');if(!btn)return;
  activeEventFilter=btn.dataset.filter||'all';
  document.querySelectorAll('.event-filter').forEach(x=>x.classList.toggle('active',x===btn));
  renderEventRows();
});

loadSystemEvents();
setInterval(loadSystemEvents,60000);

