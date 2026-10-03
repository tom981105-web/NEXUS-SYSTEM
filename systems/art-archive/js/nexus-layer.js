(()=>{
  'use strict';

  const SOURCES=[
    {key:'automation',label:'AUTOMATION',file:'automation-status.json',url:'https://raw.githubusercontent.com/tom981105-web/art-archive/main/automation-status.json'},
    {key:'runtime',label:'RUNTIME',file:'system-status.json',url:'https://raw.githubusercontent.com/tom981105-web/art-archive/main/system-status.json'},
    {key:'usage',label:'USAGE',file:'system-usage.json',url:'https://raw.githubusercontent.com/tom981105-web/art-archive/main/system-usage.json'},
    {key:'events',label:'EVENTS',file:'system-events.json',url:'https://raw.githubusercontent.com/tom981105-web/art-archive/main/system-events.json'},
    {key:'history',label:'HISTORY',file:'system-history.json',url:'https://raw.githubusercontent.com/tom981105-web/art-archive/main/system-history.json'}
  ];
  const state={};
  let latestSourceSnapshot=null;

  const $=s=>document.querySelector(s);
  const fmtAge=ms=>{
    if(!Number.isFinite(ms)||ms<0)return 'UNKNOWN';
    const min=Math.floor(ms/60000);
    if(min<1)return '< 1 MIN';
    if(min<60)return min+' MIN';
    const h=Math.floor(min/60),m=min%60;
    return h+'H '+m+'M';
  };
  const fmtTime=d=>d?new Intl.DateTimeFormat('ko-KR',{
    timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).format(d):'—';

  function extractTimestamp(data){
    const candidates=[
      data&&data.updatedAt,data&&data.generatedAt,data&&data.timestamp,
      data&&data.githubDeploy&&data.githubDeploy.updatedAt,
      data&&data.appsScript&&data.appsScript.lastRun&&data.appsScript.lastRun.finishedAt,
      data&&data.summary&&data.summary.updatedAt
    ].filter(Boolean);
    const parsed=candidates.map(v=>new Date(v)).filter(d=>!isNaN(d));
    return parsed.length?new Date(Math.max(...parsed.map(d=>d.getTime()))):null;
  }

  function grade(entry){
    if(!entry||entry.error)return {cls:'bad',label:'UNAVAILABLE'};
    if(!entry.timestamp)return {cls:'warn',label:'CONNECTED'};
    const age=Date.now()-entry.timestamp.getTime();
    if(age<=10*60000)return {cls:'good',label:'FRESH'};
    if(age<=30*60000)return {cls:'warn',label:'DELAYED'};
    return {cls:'bad',label:'STALE'};
  }

  function setLiveCard(id,stateLabel,cls){
    const card=$(id);
    if(card) card.className='live-service-card '+cls;
    return {label:stateLabel,cls};
  }

  function renderLiveSystemRoom(){
    const automation=state.automation&&state.automation.data;
    const runtime=state.runtime&&state.runtime.data;

    let worst=0;
    const rank={good:0,warn:1,bad:2};
    const mark=cls=>{worst=Math.max(worst,rank[cls]??2)};

    // Drive
    const series=automation&&Array.isArray(automation.series)?automation.series.filter(x=>x.name!=='자동화 상태'):[];
    const connected=series.filter(x=>x.driveStatus==='ok').length;
    const latestArtwork=series.map(x=>({name:x.lastFile,time:x.lastSavedAt?new Date(x.lastSavedAt):null})).filter(x=>x.time&&!isNaN(x.time)).sort((a,b)=>b.time-a.time)[0];
    const driveCls=series.length&&connected===series.length?'good':connected>0?'warn':'bad';
    setLiveCard('#liveDriveCard',driveCls==='good'?'CONNECTED':driveCls==='warn'?'PARTIAL':'ATTENTION',driveCls);mark(driveCls);
    if($('#liveDriveState')){$('#liveDriveState').textContent=driveCls==='good'?'CONNECTED':driveCls==='warn'?'PARTIAL':'ATTENTION';$('#liveDriveState').className=driveCls}
    if($('#liveDriveSeries'))$('#liveDriveSeries').textContent=series.length?connected+' / '+series.length:'—';
    if($('#liveDriveLast'))$('#liveDriveLast').textContent=latestArtwork?fmtTime(latestArtwork.time):'—';
    if($('#liveDriveCopy'))$('#liveDriveCopy').textContent=series.length?connected+'개 시리즈의 Drive 폴더 연결 상태를 확인했습니다.':'Drive 시리즈 상태 데이터가 없습니다.';

    // Apps Script
    const run=runtime&&runtime.appsScript&&runtime.appsScript.lastRun;
    const scriptFail=runtime&&runtime.appsScript?Number(runtime.appsScript.consecutiveFailures||0):null;
    const scriptOk=run&&String(run.result).toLowerCase()==='success'&&(!scriptFail);
    const scriptBusy=runtime&&runtime.appsScript&&runtime.appsScript.busyOrSkipped;
    const scriptCls=scriptOk?'good':scriptBusy?'warn':'bad';
    setLiveCard('#liveScriptCard','',scriptCls);mark(scriptCls);
    if($('#liveScriptState')){$('#liveScriptState').textContent=scriptOk?'OPERATIONAL':scriptBusy?'BUSY':'ATTENTION';$('#liveScriptState').className=scriptCls}
    if($('#liveScriptFunction'))$('#liveScriptFunction').textContent=run&&run.functionName||'—';
    if($('#liveScriptLast'))$('#liveScriptLast').textContent=run&&run.finishedAt?fmtTime(new Date(run.finishedAt)):'—';
    if($('#liveScriptCopy'))$('#liveScriptCopy').textContent=scriptOk?'최근 Apps Script 실행이 정상 완료되었습니다.':scriptBusy?'실행이 대기 또는 건너뛰기 상태입니다.':'최근 실행 오류 또는 연속 실패를 확인해야 합니다.';

    // Notion
    const notion=runtime&&runtime.notionSync;
    const notionFail=notion?Number(notion.consecutiveFailures||0):null;
    const notionOk=notion&&String(notion.lastResult).toLowerCase()==='success'&&(!notionFail);
    const notionCls=notionOk?'good':notion?'warn':'bad';
    setLiveCard('#liveNotionCard','',notionCls);mark(notionCls);
    if($('#liveNotionState')){$('#liveNotionState').textContent=notionOk?'SYNCED':notion?'CHECK':'UNAVAILABLE';$('#liveNotionState').className=notionCls}
    if($('#liveNotionSeries'))$('#liveNotionSeries').textContent=notion&&notion.lastSeries||'—';
    if($('#liveNotionLast'))$('#liveNotionLast').textContent=notion&&notion.finishedAt?fmtTime(new Date(notion.finishedAt)):'—';
    if($('#liveNotionCopy'))$('#liveNotionCopy').textContent=notionOk?'최근 Notion 아카이브 동기화가 정상 완료되었습니다.':notion?'Notion 동기화 상태를 확인해야 합니다.':'Notion 상태 데이터가 없습니다.';

    // GitHub
    const deploy=runtime&&runtime.githubDeploy;
    const latest=deploy&&deploy.latestRun;
    const deployOk=latest&&latest.status==='completed'&&latest.conclusion==='success';
    const deployBusy=latest&&latest.status!=='completed';
    const githubCls=deployOk?'good':deployBusy?'warn':latest?'bad':'warn';
    setLiveCard('#liveGithubCard','',githubCls);mark(githubCls);
    if($('#liveGithubState')){$('#liveGithubState').textContent=deployOk?'DEPLOYED':deployBusy?'DEPLOYING':latest?'ATTENTION':'NO DATA';$('#liveGithubState').className=githubCls}
    if($('#liveGithubDeploy'))$('#liveGithubDeploy').textContent=latest&&latest.conclusion?String(latest.conclusion).toUpperCase():latest&&latest.status?String(latest.status).toUpperCase():'—';
    if($('#liveGithubLast'))$('#liveGithubLast').textContent=latest&&latest.updated_at?fmtTime(new Date(latest.updated_at)):'—';
    if($('#liveGithubCopy'))$('#liveGithubCopy').textContent=deployOk?'최근 GitHub Pages 배포가 정상 완료되었습니다.':deployBusy?'현재 배포가 진행 중입니다.':latest?'최근 배포 결과를 확인해야 합니다.':'배포 상태 데이터가 없습니다.';

    const orb=$('#liveRoomOrb'),overall=$('#liveRoomState');
    if(orb&&overall){
      const cls=worst===0?'good':worst===1?'warn':'bad';
      orb.className=cls;
      overall.textContent=worst===0?'OPERATIONAL':worst===1?'DEGRADED':'ATTENTION';
      overall.className=cls;
    }
    if($('#liveRoomTimestamp'))$('#liveRoomTimestamp').textContent='LAST CHECK '+fmtTime(new Date());
  }

  function renderIncidentRadar(){
    const events=state.events&&state.events.data&&Array.isArray(state.events.data.events)?state.events.data.events:[];
    const recent=events.slice(0,12);
    const classify=e=>{
      const s=String([e.level,e.type,e.status,e.result,e.message].filter(Boolean).join(' ')).toLowerCase();
      if(/critical|error|failed|failure/.test(s))return 'bad';
      if(/warning|warn|busy|delay|skip|degraded/.test(s))return 'warn';
      if(/recover|success|resolved|normal|ok/.test(s))return 'good';
      return 'neutral';
    };
    const critical=recent.filter(e=>classify(e)==='bad').length;
    const warning=recent.filter(e=>classify(e)==='warn').length;
    const recovery=recent.filter(e=>classify(e)==='good'&&/recover|resolved|success|normal|ok/i.test(String([e.type,e.status,e.result,e.message].filter(Boolean).join(' ')))).length;
    if($('#incidentCritical'))$('#incidentCritical').textContent=critical;
    if($('#incidentWarning'))$('#incidentWarning').textContent=warning;
    if($('#incidentRecovery'))$('#incidentRecovery').textContent=recovery;
    const latest=recent[0];
    const latestTime=latest&&(latest.time||latest.timestamp||latest.createdAt||latest.at);
    if($('#incidentLast'))$('#incidentLast').textContent=latestTime?fmtTime(new Date(latestTime)):'—';
    if($('#incidentLastCopy'))$('#incidentLastCopy').textContent=latest?(latest.service||latest.source||latest.type||'latest event'):'no events';
    const level=critical?'ATTENTION':warning?'WATCH':'CLEAR',cls=critical?'bad':warning?'warn':'good';
    if($('#incidentLevel')){$('#incidentLevel').textContent=level;$('#incidentLevel').className=cls}
    if($('#incidentLevelOrb'))$('#incidentLevelOrb').className=cls;
    const box=$('#incidentRadarList');
    if(box)box.innerHTML=recent.length?recent.map(e=>{
      const c=classify(e),sev=c==='bad'?'CRITICAL':c==='warn'?'WARNING':c==='good'?'RECOVERY':'INFO';
      const t=e.time||e.timestamp||e.createdAt||e.at;
      const svc=e.service||e.source||e.category||e.type||'SYSTEM';
      const msg=e.message||e.detail||e.reason||e.status||e.result||'Event recorded';
      return '<div class="incident-radar-item '+c+'"><span class="sev">'+sev+'</span><time>'+ (t?fmtTime(new Date(t)):'—') +'</time><b>'+String(svc)+'</b><small>'+String(msg)+'</small></div>';
    }).join(''):'<p class="muted">최근 운영 이벤트가 없습니다.</p>';
  }

  function renderOverviewIntel(){
    const usage=state.usage&&state.usage.data;
    const automation=state.automation&&state.automation.data;
    const events=state.events&&state.events.data;

    const freshest=SOURCES.map(s=>state[s.key]).filter(e=>e&&e.timestamp&&!e.error).sort((a,b)=>b.timestamp-a.timestamp)[0];
    const ageMs=freshest?Date.now()-freshest.timestamp.getTime():null;
    const ageMin=Number.isFinite(ageMs)?Math.floor(ageMs/60000):null;
    const freshPct=ageMin===null?0:Math.max(0,Math.min(100,100-(ageMin/30*100)));
    if($('#overviewFreshnessAge'))$('#overviewFreshnessAge').textContent=ageMin===null?'—':fmtAge(ageMs);
    if($('#overviewFreshnessBar'))$('#overviewFreshnessBar').style.width=freshPct+'%';
    if($('#overviewFreshnessState')){
      const cls=ageMin===null?'bad':ageMin<=10?'good':ageMin<=30?'warn':'bad';
      $('#overviewFreshnessState').textContent=ageMin===null?'UNKNOWN':ageMin<=10?'FRESH':ageMin<=30?'DELAYED':'STALE';
      $('#overviewFreshnessState').className=cls;
    }
    if($('#overviewFreshnessCopy'))$('#overviewFreshnessCopy').textContent=ageMin===null?'최신 타임스탬프를 확인할 수 없습니다.':ageMin<=10?'운영 데이터가 정상 최신 상태입니다.':ageMin<=30?'미러 동기화가 평소보다 늦습니다.':'운영 데이터가 오래되어 원본 상태 확인이 필요합니다.';

    const summary=usage&&usage.summary;
    const successRate=summary&&Number.isFinite(Number(summary.successRate))?Number(summary.successRate):null;
    if($('#overviewQualityRate'))$('#overviewQualityRate').textContent=successRate===null?'—':successRate.toFixed(1)+'%';
    if($('#overviewQualityBar'))$('#overviewQualityBar').style.width=(successRate===null?0:Math.max(0,Math.min(100,successRate)))+'%';
    if($('#overviewQualityState')){
      const cls=successRate===null?'neutral':successRate>=98?'good':successRate>=90?'warn':'bad';
      $('#overviewQualityState').textContent=successRate===null?'NO DATA':successRate>=98?'EXCELLENT':successRate>=90?'WATCH':'ATTENTION';
      $('#overviewQualityState').className=cls;
    }
    if($('#overviewQualityCopy')){
      const runs=summary&&summary.runs!=null?summary.runs:'—';
      const failed=summary&&summary.failed!=null?summary.failed:'—';
      $('#overviewQualityCopy').textContent='최근 '+runs+'회 실행 · 실패 '+failed+'회';
    }

    const list=(events&&Array.isArray(events.events)?events.events:[]).slice(0,5);
    const bad=list.filter(e=>/error|fail|critical/i.test(String(e.level||e.type||e.status||''))).length;
    const warn=list.filter(e=>/warn|busy|delay|skip/i.test(String(e.level||e.type||e.status||''))).length;
    if($('#overviewSignalCount'))$('#overviewSignalCount').textContent=bad+warn;
    if($('#overviewSignalState')){
      const cls=bad?'bad':warn?'warn':'good';
      $('#overviewSignalState').textContent=bad?'ATTENTION':warn?'WATCH':'CLEAR';
      $('#overviewSignalState').className=cls;
    }
    if($('#overviewSignalCopy'))$('#overviewSignalCopy').textContent=bad?'최근 중요 이상 이벤트가 있습니다.':warn?'최근 주의 이벤트가 감지되었습니다.':'최근 이벤트에서 중요 이상징후가 없습니다.';
    const dots=$('#overviewSignalDots');
    if(dots){
      const states=list.map(e=>/error|fail|critical/i.test(String(e.level||e.type||e.status||''))?'bad':/warn|busy|delay|skip/i.test(String(e.level||e.type||e.status||''))?'warn':'good');
      dots.innerHTML=[0,1,2,3,4].map(i=>'<i class="'+(states[i]||'')+'"></i>').join('');
    }

    const series=(automation&&Array.isArray(automation.series)?automation.series:[]).filter(x=>x.name!=='자동화 상태');
    const monitoredNames=['크레스트','묵수','신수','수채화','펄퍼스','잉크','성수','융화'];
    const rows=monitoredNames.map(n=>series.find(x=>x.name===n)).filter(Boolean);
    const grid=$('#overviewSeriesGrid');
    if(grid){
      grid.innerHTML=rows.map(x=>{
        const age=x.lastSavedAt?Date.now()-new Date(x.lastSavedAt).getTime():null;
        const dot=age===null?'':age<=24*60*60*1000?'good':'warn';
        return '<div class="overview-series-item"><div class="top"><b>'+x.name+'</b><i class="'+dot+'"></i></div><strong>'+(x.todayCount||0)+' <small>TODAY</small></strong><small>'+(x.lastFile||'최근 파일 없음')+'</small><small>TOTAL '+(x.totalCount||0)+' · '+fmtDate(x.lastSavedAt)+'</small></div>';
      }).join('')||'<div class="overview-series-loading">시리즈 상태 데이터가 없습니다.</div>';
    }
    if($('#overviewSeriesSummary')){
      const today=rows.reduce((a,x)=>a+(x.todayCount||0),0);
      $('#overviewSeriesSummary').textContent=rows.length+' SERIES · '+today+' TODAY';
    }
  }

  function render(){
    const grid=$('#sourceGrid');
    if(!grid)return;
    let connected=0;
    let newest=null;
    let worst=0;
    const rank={good:0,warn:1,bad:2};

    grid.innerHTML=SOURCES.map(src=>{
      const e=state[src.key];
      const g=grade(e);
      if(e&&!e.error)connected++;
      if(e&&e.timestamp&&(!newest||e.timestamp>newest))newest=e.timestamp;
      worst=Math.max(worst,rank[g.cls]);
      const age=e&&e.timestamp?fmtAge(Date.now()-e.timestamp.getTime()):e&&e.error?'FETCH ERROR':'NO TIMESTAMP';
      return '<div class="source-card '+g.cls+'"><span>'+src.label+'</span><b>'+g.label+'</b><small>'+src.file+'</small><div class="source-age">'+age+'</div></div>';
    }).join('');

    if($('#sourceCount'))$('#sourceCount').textContent=connected+' / '+SOURCES.length;
    renderOverviewIntel();
    renderLiveSystemRoom();
    renderIncidentRadar();
    if($('#sourceChecked'))$('#sourceChecked').textContent=fmtTime(new Date());
    if($('#dataAge'))$('#dataAge').textContent=newest?fmtAge(Date.now()-newest.getTime()):'UNKNOWN';

    const orb=$('#sourceOrb'),label=$('#sourceState');
    if(orb&&label){
      orb.className=worst===0?'good':worst===1?'warn':'bad';
      label.textContent=worst===0?'ALL SOURCES FRESH':worst===1?'SOURCE DELAY':'SOURCE ATTENTION';
      label.className=worst===0?'good':worst===1?'warn':'bad';
    }
  }

  async function checkSource(src){
    try{
      const r=await fetch(src.url+'?nexus='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const data=await r.json();
      state[src.key]={timestamp:extractTimestamp(data),error:null,data};
    }catch(error){
      state[src.key]={timestamp:null,error:String(error)};
    }
  }

  async function verify(){
    await Promise.all(SOURCES.map(checkSource));
    render();
  }

  verify();
  setInterval(verify,60000);
})();