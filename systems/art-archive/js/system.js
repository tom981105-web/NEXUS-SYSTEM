const ART_DATA_BASE='https://raw.githubusercontent.com/tom981105-web/art-archive/main/';
const $=s=>document.querySelector(s);const fmtDate=v=>v?new Date(v).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
function tick(){const d=new Date();$('#clock').textContent=d.toLocaleTimeString('ko-KR',{hour12:false});$('#footerTime').textContent=d.toLocaleString('ko-KR')}tick();setInterval(tick,1000);const monitored=['크레스트','묵수','신수','수채화','펄퍼스','잉크','성수','융화'];
const systemHealthState={drive:null,script:null,notion:null,deploy:null,reliability:null,performance:null,delivery:null};
const alertState={drive:null,script:null,schedule:null,notion:null,deploy:null};
const todayOpsState={autoCount:null,manualCount:null,manualUpdated:null,manualTotal:null,failed:null,driveVerified:null,autoRuns:null};
const telemetryState={autoSeries:[],manualSeries:[],usage:null,history:null,github:null,events:[],visibleRuns:[],visibleQualityRuns:[],anomalyRuns:[],multiMetric:'avgElapsed',hiddenSeries:new Set(),filter:{range:'24h',series:'all'}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const parseRunDate=v=>{if(!v)return null;const s=String(v);const d=/[zZ]|[+-]\d\d:?\d\d$/.test(s)?new Date(s):new Date(s.replace(' ','T')+'+09:00');return isNaN(d)?null:d};
const kstHour=d=>Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hour:'2-digit',hourCycle:'h23'}).format(d));
const rangeMs={ '1h':60*60*1000,'6h':6*60*60*1000,'24h':24*60*60*1000,'7d':7*24*60*60*1000,'30d':30*24*60*60*1000 };
function filteredTelemetryRuns(){
  const raw=((telemetryState.usage||{}).recentRuns)||[];
  const f=telemetryState.filter||{range:'24h',series:'all'};
  const cutoff=Date.now()-(rangeMs[f.range]||rangeMs['24h']);
  return raw.filter(x=>{
    const d=parseRunDate(x.time);
    const timeOk=!d||d.getTime()>=cutoff;
    const seriesOk=f.series==='all'||x.series===f.series;
    return timeOk&&seriesOk;
  });
}
function filteredSeriesStats(){
  const rows=((telemetryState.usage||{}).series)||[];
  return telemetryState.filter.series==='all'?rows:rows.filter(x=>x.name===telemetryState.filter.series);
}
function filteredHistoryDays(){
  const h=telemetryState.history||{},days=h.daily||[];
  if(!days.length)return [];
  const count=telemetryState.filter.range==='30d'?30:telemetryState.filter.range==='7d'?7:0;
  if(!count)return [];
  return days.slice(-count);
}
function aggregateHistory(){
  const days=filteredHistoryDays();
  if(!days.length)return null;
  const selected=telemetryState.filter.series;
  const rows=[];
  days.forEach(day=>{
    if(selected==='all')rows.push({
      date:day.date,runs:day.runs||0,success:day.success||0,failed:day.failed||0,
      successRate:Number.isFinite(Number(day.successRate))?Number(day.successRate):((day.runs||0)?((day.success||0)/(day.runs||0)*100):null),
      avgElapsed:day.avgElapsed,driveVerified:day.driveVerified||0,regenerations:day.regenerations||0
    });
    else{
      const s=(day.series||[]).find(x=>x.name===selected);
      rows.push({
        date:day.date,runs:s?s.runs||0:0,success:s?s.success||0:0,failed:s?s.failed||0:0,
        successRate:s&&Number.isFinite(Number(s.successRate))?Number(s.successRate):(s&&s.runs?((s.success||0)/s.runs*100):null),
        avgElapsed:s?s.avgElapsed:null,driveVerified:s?s.driveVerified||0:0,regenerations:s?s.regenerations||0:0
      });
    }
  });
  const runs=rows.reduce((a,x)=>a+x.runs,0),success=rows.reduce((a,x)=>a+x.success,0),failed=rows.reduce((a,x)=>a+x.failed,0),verified=rows.reduce((a,x)=>a+x.driveVerified,0);
  const elapsedRows=rows.filter(x=>Number.isFinite(Number(x.avgElapsed))&&x.runs>0);
  const weightedElapsed=elapsedRows.length?elapsedRows.reduce((a,x)=>a+Number(x.avgElapsed)*x.runs,0)/elapsedRows.reduce((a,x)=>a+x.runs,0):null;
  const bySeries={};
  days.forEach(day=>(day.series||[]).forEach(s=>{
    if(selected!=='all'&&s.name!==selected)return;
    if(!bySeries[s.name])bySeries[s.name]={name:s.name,runs:0,success:0,failed:0,driveVerified:0,weightedElapsed:0,elapsedRuns:0,regenerations:0};
    const a=bySeries[s.name];a.runs+=s.runs||0;a.success+=s.success||0;a.failed+=s.failed||0;a.driveVerified+=s.driveVerified||0;a.regenerations+=s.regenerations||0;
    if(Number.isFinite(Number(s.avgElapsed))&&(s.runs||0)>0){a.weightedElapsed+=Number(s.avgElapsed)*(s.runs||0);a.elapsedRuns+=s.runs||0}
  }));
  const series=Object.values(bySeries).map(s=>({name:s.name,runs:s.runs,success:s.success,failed:s.failed,driveVerified:s.driveVerified,regenerations:s.regenerations,avgElapsed:s.elapsedRuns?s.weightedElapsed/s.elapsedRuns:null}));
  return {days:rows,runs,success,failed,verified,avgElapsed:weightedElapsed,series};
}
function dailyBarSvg(days,key){
  const rows=days||[];
  if(!rows.length)return '<p class="muted">장기 일별 데이터가 없습니다.</p>';
  const w=520,h=210,l=34,r=8,t=12,b=30,vals=rows.map(x=>Number(x[key])||0),max=Math.max(1,...vals);
  const slot=(w-l-r)/rows.length,barW=Math.max(7,slot*.55);
  let grid='',labels='',bars='';
  for(let i=0;i<=4;i++){const v=Math.round(max*(1-i/4));const y=t+(h-t-b)*(i/4);grid+='<line class="daily-grid" x1="'+l+'" y1="'+y+'" x2="'+(w-r)+'" y2="'+y+'"></line>';labels+='<text class="daily-axis" x="2" y="'+(y+3)+'">'+v+'</text>'}
  rows.forEach((row,i)=>{const v=Number(row[key])||0,x=l+slot*i+(slot-barW)/2,y=t+(h-t-b)*(1-v/max),bh=(h-b)-y;bars+='<rect class="daily-bar" x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+Math.max(1,bh).toFixed(1)+'" rx="3"><title>'+row.date+' · '+v+'</title></rect><text class="daily-axis" x="'+(x+barW/2).toFixed(1)+'" y="'+(h-9)+'" text-anchor="middle">'+String(row.date).slice(5)+'</text>'});
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+grid+labels+bars+'</svg>';
}
function dailyLineSvg(days,key,maxOverride,className,suffix){
  const rows=(days||[]).filter(x=>Number.isFinite(Number(x[key])));
  if(!rows.length)return '<p class="muted">장기 일별 데이터가 없습니다.</p>';
  const w=520,h=210,l=38,r=10,t=12,b=30,vals=rows.map(x=>Number(x[key]));
  const max=Math.max(maxOverride||0,...vals,1),min=0,span=Math.max(1,max-min);
  const x=i=>rows.length===1?(l+(w-l-r)/2):l+(w-l-r)*(i/(rows.length-1));
  const y=v=>t+(h-t-b)*(1-(v-min)/span);
  let grid='',labels='';
  for(let i=0;i<=4;i++){const v=Math.round(max*(1-i/4));const yy=t+(h-t-b)*(i/4);grid+='<line class="daily-grid" x1="'+l+'" y1="'+yy+'" x2="'+(w-r)+'" y2="'+yy+'"></line>';labels+='<text class="daily-axis" x="2" y="'+(yy+3)+'">'+v+(suffix||'')+'</text>'}
  const pts=rows.map((row,i)=>[x(i),y(Number(row[key])),row]),line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const dots=pts.map(p=>'<circle class="daily-point '+(key==='successRate'&&Number(p[2][key])<100?'bad':'')+'" cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="4"><title>'+p[2].date+' · '+Number(p[2][key]).toFixed(key==='successRate'?1:0)+(suffix||'')+'</title></circle>').join('');
  const xlabels=rows.map((row,i)=>'<text class="daily-axis" x="'+x(i).toFixed(1)+'" y="'+(h-9)+'" text-anchor="middle">'+String(row.date).slice(5)+'</text>').join('');
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+grid+labels+'<path class="daily-line '+(className||'')+'" d="'+line+'"></path>'+dots+xlabels+'</svg>';
}

const multiSeriesColors={
  '크레스트':'#9ee6b2','묵수':'#93bdd5','신수':'#d8b48a','수채화':'#b49bd8',
  '펄퍼스':'#e5a7b8','잉크':'#a7afb6','성수':'#e0c06e','융화':'#82c9c2'
};
function multiSeriesTrendSvg(days,metric,seriesNames){
  const rows=days||[];
  if(!rows.length||!seriesNames.length)return '<div class="multi-empty">비교할 장기 데이터가 없습니다.</div>';
  const values=[];
  rows.forEach(day=>(day.series||[]).forEach(s=>{
    if(seriesNames.includes(s.name)){
      const v=metric==='successRate'?Number(s.successRate):Number(s[metric]);
      if(Number.isFinite(v))values.push(v);
    }
  }));
  if(!values.length)return '<div class="multi-empty">선택한 지표의 데이터가 아직 없습니다.</div>';
  const w=1040,h=320,l=48,r=20,t=18,b=34;
  const ymax=metric==='successRate'?100:Math.max(1,Math.ceil(Math.max(...values)/(metric==='avgElapsed'?30:1))*(metric==='avgElapsed'?30:1));
  const x=i=>rows.length===1?(l+(w-l-r)/2):l+(w-l-r)*(i/(rows.length-1));
  const y=v=>t+(h-t-b)*(1-clamp(v/ymax,0,1));
  let grid='',labels='';
  for(let i=0;i<=4;i++){
    const val=ymax*(1-i/4),yy=t+(h-t-b)*(i/4);
    const display=metric==='successRate'?Math.round(val)+'%':metric==='avgElapsed'?Math.round(val)+'s':Math.round(val);
    grid+='<line class="multi-grid" x1="'+l+'" y1="'+yy+'" x2="'+(w-r)+'" y2="'+yy+'"></line>';
    labels+='<text class="multi-axis" x="3" y="'+(yy+3)+'">'+display+'</text>';
  }
  const xlabels=rows.map((row,i)=>'<text class="multi-axis" x="'+x(i).toFixed(1)+'" y="'+(h-9)+'" text-anchor="middle">'+String(row.date).slice(5)+'</text>').join('');
  let seriesSvg='';
  seriesNames.forEach(name=>{
    const color=multiSeriesColors[name]||'#aab2af';
    const points=[];
    rows.forEach((day,i)=>{
      const s=(day.series||[]).find(x=>x.name===name);
      if(!s)return;
      const v=metric==='successRate'?Number(s.successRate):Number(s[metric]);
      if(Number.isFinite(v))points.push({x:x(i),y:y(v),v,date:day.date});
    });
    if(!points.length)return;
    const path=points.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
    const suffix=metric==='successRate'?'%':metric==='avgElapsed'?'s':'';
    seriesSvg+='<g style="--series-color:'+color+'"><path class="multi-line" d="'+path+'"></path>'+points.map(p=>'<circle class="multi-point" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.5"><title>'+name+' · '+p.date+' · '+(metric==='successRate'?p.v.toFixed(1):Math.round(p.v))+suffix+'</title></circle>').join('')+'</g>';
  });
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+grid+labels+seriesSvg+xlabels+'</svg>';
}
function renderMultiSeriesTrend(days){
  const chart=$('#multiSeriesTrendChart'),legend=$('#multiSeriesLegend');if(!chart||!legend)return;
  const baseNames=telemetryState.filter.series==='all'?monitored:[telemetryState.filter.series];
  const available=baseNames.filter(name=>(days||[]).some(day=>(day.series||[]).some(s=>s.name===name)));
  if(!(telemetryState.hiddenSeries instanceof Set))telemetryState.hiddenSeries=new Set();
  const active=available.filter(name=>!telemetryState.hiddenSeries.has(name));
  legend.innerHTML=available.map(name=>'<button class="'+(telemetryState.hiddenSeries.has(name)?'off':'')+'" data-multi-series="'+name+'" style="--series-color:'+(multiSeriesColors[name]||'#aab2af')+'"><i></i>'+name+'</button>').join('')||'<span class="muted">표시 가능한 시리즈가 없습니다.</span>';
  if(!telemetryState.multiMetric)telemetryState.multiMetric='avgElapsed';
  chart.innerHTML=multiSeriesTrendSvg(days,telemetryState.multiMetric,active);
  const labels={avgElapsed:'AVERAGE RUNTIME · SECONDS',runs:'RUNS PER DAY',successRate:'SUCCESS RATE · %'};
  if($('#multiMetricLabel'))$('#multiMetricLabel').textContent=labels[telemetryState.multiMetric]||labels.avgElapsed;
  if($('#multiSeriesCoverage'))$('#multiSeriesCoverage').textContent=active.length+' / '+available.length+' SERIES VISIBLE';
  document.querySelectorAll('#multiMetricSwitch button').forEach(b=>b.classList.toggle('active',b.dataset.metric===telemetryState.multiMetric));
}

function renderLongRangeAnalysis(){
  const box=$('#longRangeAnalysis');if(!box)return;
  const longRange=telemetryState.filter.range==='7d'||telemetryState.filter.range==='30d';
  if(!longRange){box.hidden=true;return}
  box.hidden=false;
  const hist=aggregateHistory(),days=hist?hist.days:[];
  const requested=telemetryState.filter.range==='30d'?30:7;
  if($('#longRangeCoverage'))$('#longRangeCoverage').textContent=days.length+' / '+requested+' DAYS AVAILABLE';
  if(!hist||!days.length){
    if($('#dailyRunsTotal'))$('#dailyRunsTotal').textContent='—';
    if($('#dailyRunsAvg'))$('#dailyRunsAvg').textContent='NO DATA';
    if($('#dailySuccessAvg'))$('#dailySuccessAvg').textContent='—';
    if($('#dailyFailureTotal'))$('#dailyFailureTotal').textContent='NO DATA';
    if($('#dailyRuntimeAvg'))$('#dailyRuntimeAvg').textContent='—';
    if($('#dailyRuntimePeak'))$('#dailyRuntimePeak').textContent='NO DATA';
    if($('#dailyRunsChart'))$('#dailyRunsChart').innerHTML='<p class="muted">장기 히스토리 파일을 불러오지 못했습니다. 자동 재시도합니다.</p>';
    if($('#dailySuccessChart'))$('#dailySuccessChart').innerHTML='<p class="muted">장기 히스토리 파일을 불러오지 못했습니다. 자동 재시도합니다.</p>';
    if($('#dailyRuntimeChart'))$('#dailyRuntimeChart').innerHTML='<p class="muted">장기 히스토리 파일을 불러오지 못했습니다. 자동 재시도합니다.</p>';
    renderMultiSeriesTrend([]);
    return;
  }
  const totalRuns=days.reduce((a,x)=>a+(x.runs||0),0),avgRuns=days.length?totalRuns/days.length:0;
  const totalSuccess=days.reduce((a,x)=>a+(x.success||0),0),successRate=totalRuns?totalSuccess/totalRuns*100:0;
  const totalFailed=days.reduce((a,x)=>a+(x.failed||0),0);
  const runtimeRows=days.filter(x=>Number.isFinite(Number(x.avgElapsed))&&x.runs>0);
  const weightedRuntime=runtimeRows.length?runtimeRows.reduce((a,x)=>a+Number(x.avgElapsed)*x.runs,0)/runtimeRows.reduce((a,x)=>a+x.runs,0):null;
  const peakRuntime=runtimeRows.length?Math.max(...runtimeRows.map(x=>Number(x.avgElapsed))):null;
  if($('#dailyRunsTotal'))$('#dailyRunsTotal').textContent=totalRuns;
  if($('#dailyRunsAvg'))$('#dailyRunsAvg').textContent='AVG '+avgRuns.toFixed(1)+' / DAY';
  if($('#dailySuccessAvg'))$('#dailySuccessAvg').textContent=successRate.toFixed(1)+'%';
  if($('#dailyFailureTotal'))$('#dailyFailureTotal').textContent=totalFailed+' FAILURES';
  if($('#dailyRuntimeAvg'))$('#dailyRuntimeAvg').textContent=weightedRuntime===null?'—':Math.round(weightedRuntime)+'s';
  if($('#dailyRuntimePeak'))$('#dailyRuntimePeak').textContent=peakRuntime===null?'—':'PEAK '+Math.round(peakRuntime)+'s';
  if($('#dailyRunsChart'))$('#dailyRunsChart').innerHTML=dailyBarSvg(days,'runs');
  if($('#dailySuccessChart'))$('#dailySuccessChart').innerHTML=dailyLineSvg(days,'successRate',100,'success','%');
  if($('#dailyRuntimeChart'))$('#dailyRuntimeChart').innerHTML=dailyLineSvg(days,'avgElapsed',null,'runtime','s');
  renderMultiSeriesTrend(filteredHistoryDays());
}

function historyRuntimeSvg(days){
  const rows=(days||[]).filter(x=>Number.isFinite(Number(x.avgElapsed)));
  if(rows.length<2)return '<p class="muted">장기 실행시간 데이터가 더 쌓이면 일별 추세가 표시됩니다.</p>';
  const w=720,h=220,l=48,r=15,t=14,b=28,vals=rows.map(x=>Number(x.avgElapsed));
  const ymax=Math.max(10,Math.ceil(Math.max(...vals)/30)*30),x=i=>l+(w-l-r)*(i/(rows.length-1)),y=v=>t+(h-t-b)*(1-v/ymax);
  let grid='',labels='';for(let i=0;i<=4;i++){const val=Math.round(ymax*(1-i/4));const yy=t+(h-t-b)*(i/4);grid+='<line class="chart-grid-line" x1="'+l+'" y1="'+yy+'" x2="'+(w-r)+'" y2="'+yy+'"></line>';labels+='<text class="chart-axis-label" x="4" y="'+(yy+3)+'">'+val+'s</text>'}
  const pts=rows.map((row,i)=>[x(i),y(Number(row.avgElapsed)),row]),line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' '),area=line+' L '+pts[pts.length-1][0].toFixed(1)+' '+(h-b)+' L '+pts[0][0].toFixed(1)+' '+(h-b)+' Z';
  const dots=pts.map(p=>'<circle class="chart-point" cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="4"><title>'+p[2].date+' · '+Math.round(Number(p[2].avgElapsed))+'s</title></circle>').join('');
  const step=Math.max(1,Math.ceil(rows.length/6)),xlabels=rows.map((row,i)=>i%step===0?'<text class="chart-axis-label" x="'+x(i).toFixed(1)+'" y="'+(h-7)+'" text-anchor="middle">'+String(row.date).slice(5)+'</text>':'').join('');
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+grid+labels+'<path class="chart-series-area" d="'+area+'"></path><path class="chart-series-line" d="'+line+'"></path>'+dots+xlabels+'</svg>';
}

function syncTelemetryControls(){
  const p=new URLSearchParams(location.search);
  const range=p.get('range');
  const series=p.get('series');
  if(rangeMs[range])telemetryState.filter.range=range;
  if(series&&['all',...monitored].includes(series))telemetryState.filter.series=series;
  document.querySelectorAll('#rangeControls button').forEach(b=>b.classList.toggle('active',b.dataset.range===telemetryState.filter.range));
  if($('#telemetrySeries'))$('#telemetrySeries').value=telemetryState.filter.series;
}
function persistTelemetryFilter(){
  const p=new URLSearchParams(location.search);
  p.set('range',telemetryState.filter.range);
  p.set('series',telemetryState.filter.series);
  history.replaceState(null,'',location.pathname+'?'+p.toString()+location.hash);
}
function updateAnalysisContext(runsOrCount){
  const count=typeof runsOrCount==='number'?runsOrCount:(runsOrCount||[]).length;
  if($('#analysisContext'))$('#analysisContext').textContent=telemetryState.filter.range.toUpperCase()+' · '+(telemetryState.filter.series==='all'?'ALL SERIES':telemetryState.filter.series)+' · '+count+' RUNS';
  if($('#telemetryWindow'))$('#telemetryWindow').textContent=telemetryState.filter.range.toUpperCase()+' · '+count+' RUNS';
}
function openRunDetail(run){
  if(!run)return;
  const d=$('#runDetailDrawer');if(!d)return;
  d.classList.add('open');d.setAttribute('aria-hidden','false');
  $('#runDetailTitle').textContent=(run.series||'Run')+' · '+String(run.result||'—').toUpperCase();
  $('#detailSeries').textContent=run.series||'—';
  $('#detailResult').textContent=String(run.result||'—').toUpperCase();
  $('#detailResult').className=run.result==='failed'?'bad':run.result==='success'?'good':'neutral';
  $('#detailRuntime').textContent=run.elapsedSeconds!==null&&run.elapsedSeconds!==undefined?run.elapsedSeconds+'s':'—';
  $('#detailGeneration').textContent=run.generationAttempts??'—';
  $('#detailRegeneration').textContent=run.regenerations??'—';
  $('#detailDrive').textContent=run.driveVerified===true?'YES':run.driveVerified===false?'NO':'—';
  $('#detailDrive').className=run.driveVerified===true?'good':run.driveVerified===false?'bad':'neutral';
  $('#detailScheduled').textContent=run.scheduledTime||'—';
  $('#detailDelay').textContent=run.startDelaySeconds!==null&&run.startDelaySeconds!==undefined?'+'+run.startDelaySeconds+'s':'—';
  $('#detailTime').textContent=run.time||'—';
  d.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function renderAdvancedTelemetry(){
  const usage=telemetryState.usage||{},runs=filteredTelemetryRuns(),series=filteredSeriesStats();
  const github=telemetryState.github||{},deploy=((github.githubDeploy||{}).recentRuns)||[];
  const events=telemetryState.events||[];
  const now=Date.now(),cutoff=now-(rangeMs[telemetryState.filter.range]||rangeMs['24h']);

  const timeline=[];
  runs.forEach(x=>{const d=parseRunDate(x.time);if(d&&d.getTime()>=cutoff)timeline.push({at:d,service:'Automation',level:x.result==='failed'?'error':'success',title:(x.series||'Run')+' '+String(x.result||'').toUpperCase()})});
  deploy.forEach(x=>{const d=parseRunDate(x.updated_at||x.created_at);if(d&&d.getTime()>=cutoff)timeline.push({at:d,service:'Deploy',level:x.conclusion==='success'?'success':x.conclusion==='cancelled'?'info':x.status==='completed'?'error':'warning',title:'Deploy '+String(x.conclusion||x.status||'').toUpperCase()})});
  events.forEach(x=>{const d=parseRunDate(x.at);if(d&&d.getTime()>=cutoff)timeline.push({at:d,service:x.service||'SYSTEM',level:x.level||'info',title:x.title||x.status||'Event'})});
  timeline.sort((a,b)=>a.at-b.at);
  if($('#timelineEventCount'))$('#timelineEventCount').textContent=timeline.length;
  if($('#operationsTimeline')){
    if(!timeline.length)$('#operationsTimeline').innerHTML='<p class="muted">최근 24시간 기록된 운영 이벤트가 없습니다.</p>';
    else{
      const dots=timeline.slice(-70).map((x,i)=>{const left=clamp((x.at.getTime()-cutoff)/(rangeMs[telemetryState.filter.range]||rangeMs['24h'])*100,0,100);const stem=28+(i%5)*18;return '<i class="timeline-event '+(x.level==='error'||x.level==='failure'?'error':x.level==='warning'?'warning':x.level==='success'?'success':'')+'" style="left:'+left.toFixed(2)+'%;--stem:'+stem+'px"><title>'+x.service+' · '+x.title+' · '+x.at.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+'</title></i>'}).join('');
      $('#operationsTimeline').innerHTML='<div class="timeline-track"><div class="timeline-grid">'+Array(6).fill('<i></i>').join('')+'</div>'+dots+'</div><div class="timeline-axis"><span>-24h</span><span>-18h</span><span>-12h</span><span>-6h</span><span>now</span></div>';
    }
  }

  const hours=Array.from({length:24},(_,h)=>({h,count:0}));
  runs.forEach(x=>{const d=parseRunDate(x.time);if(d&&d.getTime()>=cutoff)hours[kstHour(d)].count++});
  const hmax=Math.max(1,...hours.map(x=>x.count)),peak=hours.reduce((a,b)=>b.count>a.count?b:a,hours[0]);
  if($('#heatmapPeak'))$('#heatmapPeak').textContent=String(peak.h).padStart(2,'0')+':00 · '+peak.count;
  if($('#heatmapTotal'))$('#heatmapTotal').textContent=hours.reduce((a,x)=>a+x.count,0)+' RUNS';
  if($('#generationHeatmap'))$('#generationHeatmap').innerHTML=hours.map(x=>'<div class="heat-cell" style="--heat:'+(0.04+0.32*(x.count/hmax)).toFixed(2)+'"><span>'+String(x.h).padStart(2,'0')+':00</span><b>'+x.count+'</b></div>').join('');

  const durationSeries=series.filter(x=>Number(x.avgElapsed)>0).sort((a,b)=>Number(b.avgElapsed)-Number(a.avgElapsed));
  const dmax=Math.max(1,...durationSeries.map(x=>Number(x.avgElapsed)));
  if($('#slowestSeries'))$('#slowestSeries').textContent=durationSeries[0]?durationSeries[0].name:'—';
  if($('#durationSeriesCount'))$('#durationSeriesCount').textContent=durationSeries.length+' SERIES';
  if($('#seriesDurationChart'))$('#seriesDurationChart').innerHTML=durationSeries.length?durationSeries.map(x=>'<div class="duration-row"><span>'+x.name+'</span><div class="duration-track"><i style="width:'+clamp(Number(x.avgElapsed)/dmax*100,0,100).toFixed(1)+'%"></i></div><b>'+Math.round(Number(x.avgElapsed))+'s</b></div>').join(''):'<p class="muted">평균 처리시간 데이터가 없습니다.</p>';

  const quality=runs.slice(0,32).reverse();
  const fails=quality.filter(x=>x.result==='failed').length;
  if($('#trendFailureCount'))$('#trendFailureCount').textContent=fails;
  if($('#qualityTrendWindow'))$('#qualityTrendWindow').textContent=quality.length+' RUNS';
  if($('#qualityTrend')){telemetryState.visibleQualityRuns=quality;$('#qualityTrend').innerHTML=quality.length?quality.map((x,i)=>'<i class="quality-bar chart-clickable '+(x.result==='failed'?'fail ':'')+(Number(x.regenerations)>0?'regen':'')+'" data-quality-index="'+i+'" data-tip="'+(x.series||'—')+' · '+String(x.result||'—').toUpperCase()+' · '+(x.elapsedSeconds??'—')+'s"></i>').join(''):'<p class="muted">실행 이력이 없습니다.</p>';}

  const stateEvents=[...events].filter(x=>{const d=parseRunDate(x.at);return d&&d.getTime()>=cutoff}).sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,12);
  if($('#stateTimelineSummary'))$('#stateTimelineSummary').textContent=stateEvents.length+' STATE EVENTS';
  if($('#systemStateTimeline'))$('#systemStateTimeline').innerHTML=stateEvents.length?'<div class="state-line"></div>'+stateEvents.map(x=>{const cl=x.level==='error'||x.level==='failure'?'bad':x.level==='warning'?'warn':x.level==='success'?'good':'info';return '<div class="state-item '+cl+'"><time>'+new Date(x.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})+'</time><span class="service-name">'+(x.service||'SYSTEM')+'</span><b>'+(x.title||x.status||'Event')+'</b><em class="'+cl+'">'+String(x.status||x.level||'INFO').toUpperCase()+'</em></div>'}).join(''):'<p class="muted">최근 24시간 상태 변경 이벤트가 없습니다.</p>';
}

const pct=(n,d)=>d?Math.round(n/d*100):0;
function sparkSvg(values){
  const nums=(values||[]).map(Number).filter(Number.isFinite);
  if(nums.length<2)return '<div class="muted">데이터 축적 중</div>';
  const w=220,h=34,p=2,min=Math.min(...nums),max=Math.max(...nums),span=Math.max(1,max-min);
  const pts=nums.map((v,i)=>[p+(w-2*p)*(i/(nums.length-1)),h-p-(h-2*p)*((v-min)/span)]);
  const line=pts.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');
  const area=line+' L '+pts[pts.length-1][0].toFixed(1)+' '+h+' L '+pts[0][0].toFixed(1)+' '+h+' Z';
  return '<svg class="spark-svg" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><path class="spark-fill" d="'+area+'"></path><path class="spark-path" d="'+line+'"></path></svg>';
}
function gaugeHtml(value,label){
  const v=clamp(Number(value)||0,0,100);
  return '<div class="gauge-shell"><div class="gauge-ring" style="--pct:'+v+'%"></div><small>'+label+'</small></div>';
}
function runtimeTrendSvg(runs){
  const rows=(runs||[]).filter(x=>Number.isFinite(Number(x.elapsedSeconds))).slice(0,20).reverse();
  if(rows.length<2)return '<p class="muted">실행시간 데이터가 더 쌓이면 추세 그래프가 표시됩니다.</p>';
  const w=720,h=220,l=48,r=15,t=14,b=28;
  const vals=rows.map(x=>Number(x.elapsedSeconds));
  const ymax=Math.max(10,Math.ceil(Math.max(...vals)/30)*30);
  const x=i=>l+(w-l-r)*(i/(rows.length-1));
  const y=v=>t+(h-t-b)*(1-v/ymax);
  let grid='',labels='';
  for(let i=0;i<=4;i++){const val=Math.round(ymax*(1-i/4));const yy=t+(h-t-b)*(i/4);grid+='<line class="chart-grid-line" x1="'+l+'" y1="'+yy+'" x2="'+(w-r)+'" y2="'+yy+'"></line>';labels+='<text class="chart-axis-label" x="4" y="'+(yy+3)+'">'+val+'s</text>'}
  const pts=rows.map((row,i)=>[x(i),y(Number(row.elapsedSeconds)),row]);
  const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=line+' L '+pts[pts.length-1][0].toFixed(1)+' '+(h-b)+' L '+pts[0][0].toFixed(1)+' '+(h-b)+' Z';
  telemetryState.visibleRuns=rows; const avg=vals.reduce((a,b)=>a+b,0)/vals.length; const sorted=[...vals].sort((a,b)=>a-b); const p95=sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)]; const threshold='<line class="threshold-line" x1="'+l+'" y1="'+y(p95).toFixed(1)+'" x2="'+(w-r)+'" y2="'+y(p95).toFixed(1)+'"></line><text class="threshold-label" x="'+(w-r-2)+'" y="'+(y(p95)-4).toFixed(1)+'" text-anchor="end">P95 '+Math.round(p95)+'s</text><line class="chart-grid-line" x1="'+l+'" y1="'+y(avg).toFixed(1)+'" x2="'+(w-r)+'" y2="'+y(avg).toFixed(1)+'"></line>'; const dots=pts.map((p,i)=>'<circle class="chart-point chart-clickable '+(p[2].result==='failed'?'fail':'')+'" data-run-index="'+i+'" cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="4"><title>'+String(p[2].series||'—')+' · '+Number(p[2].elapsedSeconds).toFixed(0)+'s · '+String(p[2].result||'—')+'</title></circle>').join('');
  const step=Math.max(1,Math.ceil(rows.length/5));
  const xlabels=rows.map((row,i)=>i%step===0?'<text class="chart-axis-label" x="'+x(i).toFixed(1)+'" y="'+(h-7)+'" text-anchor="middle">'+String(row.time||'').slice(5,10)+'</text>':'').join('');
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><defs><linearGradient id="runtimeArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9ee6b2" stop-opacity=".18"></stop><stop offset="100%" stop-color="#9ee6b2" stop-opacity="0"></stop></linearGradient></defs>'+grid+labels+threshold+'<path class="chart-series-area" d="'+area+'"></path><path class="chart-series-line" d="'+line+'"></path>'+dots+xlabels+'</svg>';
}
function outputBarsSvg(autoSeries,manualSeries){
  const rows=[...(autoSeries||[]).map(x=>({name:x.name,value:Number(x.todayCount)||0,type:'auto'})),...(manualSeries||[]).map(x=>({name:x.name,value:Number(x.todayCount)||0,type:'manual'}))];
  if(!rows.length)return '<p class="muted">시리즈 데이터가 없습니다.</p>';
  const w=520,rowH=18,h=Math.max(220,rows.length*rowH+20),labelW=66,max=Math.max(1,...rows.map(x=>x.value));
  const content=rows.map((row,i)=>{const y=8+i*rowH,bw=(w-labelW-42)*(row.value/max);return '<text class="chart-label" x="0" y="'+(y+10)+'">'+row.name+'</text><rect class="chart-bar-track" x="'+labelW+'" y="'+y+'" width="'+(w-labelW-42)+'" height="10" rx="3"></rect><rect class="chart-bar '+(row.type==='manual'?'manual':'')+'" x="'+labelW+'" y="'+y+'" width="'+Math.max(row.value?3:0,bw).toFixed(1)+'" height="10" rx="3"><title>'+row.name+' · '+row.value+'</title></rect><text class="chart-value" x="'+(w-3)+'" y="'+(y+9)+'" text-anchor="end">'+row.value+'</text>'}).join('');
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+content+'</svg>';
}

function anomalyLevelRank(level){return level==='critical'?3:level==='warning'?2:1}
function detectTelemetryAnomalies(){
  const anomalies=[];
  const longRange=telemetryState.filter.range==='7d'||telemetryState.filter.range==='30d';

  if(longRange){
    const hist=aggregateHistory();
    const days=hist?hist.days:[];
    const validRuntime=days.filter(x=>Number.isFinite(Number(x.avgElapsed))&&x.runs>0);
    const baseline=validRuntime.length?validRuntime.reduce((a,x)=>a+Number(x.avgElapsed),0)/validRuntime.length:null;

    days.forEach(day=>{
      if((day.failed||0)>0)anomalies.push({
        level:'critical',time:day.date,title:'Daily failures detected',
        detail:day.failed+' failure(s) in '+day.runs+' runs',value:day.failed+' FAIL'
      });
      const sr=day.runs?day.success/day.runs*100:100;
      if(day.runs&&sr<90)anomalies.push({
        level:'critical',time:day.date,title:'Success rate dropped',
        detail:'Daily success rate fell below 90%',value:sr.toFixed(1)+'%'
      });
      else if(day.runs&&sr<98)anomalies.push({
        level:'warning',time:day.date,title:'Success rate degraded',
        detail:'Daily success rate is below 98%',value:sr.toFixed(1)+'%'
      });
      if(day.runs&&(day.driveVerified||0)<day.runs)anomalies.push({
        level:'critical',time:day.date,title:'Drive verification gap',
        detail:(day.runs-(day.driveVerified||0))+' run(s) not verified in Drive',value:(day.driveVerified||0)+' / '+day.runs
      });
      if(baseline&&Number.isFinite(Number(day.avgElapsed))&&day.avgElapsed>baseline*1.35&&day.avgElapsed-baseline>60)anomalies.push({
        level:'warning',time:day.date,title:'Runtime spike',
        detail:'Daily average runtime is '+Math.round((day.avgElapsed/baseline-1)*100)+'% above baseline',value:Math.round(day.avgElapsed)+'s'
      });
      if((day.regenerations||0)>0)anomalies.push({
        level:'watch',time:day.date,title:'Regeneration activity',
        detail:day.regenerations+' regeneration(s) recorded',value:day.regenerations+' REGEN'
      });
    });

    const historyDays=filteredHistoryDays();
    const selected=telemetryState.filter.series==='all'?monitored:[telemetryState.filter.series];
    selected.forEach(name=>{
      const samples=[];
      historyDays.forEach(day=>{
        const s=(day.series||[]).find(x=>x.name===name);
        if(s&&Number.isFinite(Number(s.avgElapsed))&&s.runs)samples.push({date:day.date,value:Number(s.avgElapsed),row:s});
      });
      if(samples.length>=3){
        const avg=samples.reduce((a,x)=>a+x.value,0)/samples.length;
        const latest=samples[samples.length-1];
        if(latest.value>avg*1.45&&latest.value-avg>75)anomalies.push({
          level:'warning',time:latest.date,title:name+' runtime anomaly',
          detail:'Latest average is '+Math.round((latest.value/avg-1)*100)+'% above series baseline',value:Math.round(latest.value)+'s'
        });
      }
    });
  }else{
    const runs=filteredTelemetryRuns();
    const durations=runs.map(x=>Number(x.elapsedSeconds)).filter(Number.isFinite);
    const sorted=[...durations].sort((a,b)=>a-b);
    const p95=sorted.length?sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)]:null;
    const seriesStats=((telemetryState.usage||{}).series)||[];
    telemetryState.anomalyRuns=[];

    runs.forEach(run=>{
      const idx=telemetryState.anomalyRuns.length;
      const when=run.time||'—';
      const elapsed=Number(run.elapsedSeconds);
      const ss=seriesStats.find(x=>x.name===run.series);
      const seriesAvg=ss&&Number.isFinite(Number(ss.avgElapsed))?Number(ss.avgElapsed):null;
      let pushedRun=false;
      const add=(obj)=>{if(!pushedRun){telemetryState.anomalyRuns.push(run);pushedRun=true}obj.runIndex=idx;anomalies.push(obj)};

      if(run.result==='failed')add({
        level:'critical',time:when,title:(run.series||'Run')+' execution failed',
        detail:'Automation run reported FAILED',value:'FAILED'
      });
      if(run.driveVerified===false)add({
        level:'critical',time:when,title:(run.series||'Run')+' Drive verification failed',
        detail:'Generated file was not verified in the target Drive folder',value:'DRIVE NO'
      });
      const delay=Number(run.startDelaySeconds);
      if(Number.isFinite(delay)&&delay>600)add({
        level:'critical',time:when,title:(run.series||'Run')+' severe schedule delay',
        detail:'Start delay exceeded 10 minutes',value:'+'+Math.round(delay)+'s'
      });
      else if(Number.isFinite(delay)&&delay>300)add({
        level:'warning',time:when,title:(run.series||'Run')+' schedule delay',
        detail:'Start delay exceeded 5 minutes',value:'+'+Math.round(delay)+'s'
      });
      const threshold=Math.max(seriesAvg?seriesAvg*1.5:0,p95||0);
      if(Number.isFinite(elapsed)&&threshold>0&&elapsed>threshold&&(seriesAvg===null||elapsed-seriesAvg>60))add({
        level:'warning',time:when,title:(run.series||'Run')+' runtime spike',
        detail:'Runtime exceeded the adaptive baseline',value:Math.round(elapsed)+'s'
      });
      if(Number(run.regenerations)>0)add({
        level:'watch',time:when,title:(run.series||'Run')+' regeneration used',
        detail:run.regenerations+' regeneration attempt(s) recorded',value:run.regenerations+' REGEN'
      });
    });
  }

  return anomalies
    .sort((a,b)=>anomalyLevelRank(b.level)-anomalyLevelRank(a.level))
    .slice(0,12);
}
function renderAnomalyCenter(){
  const list=$('#anomalyList');if(!list)return;
  const anomalies=detectTelemetryAnomalies();
  const critical=anomalies.filter(x=>x.level==='critical').length;
  const warning=anomalies.filter(x=>x.level==='warning').length;
  const watch=anomalies.filter(x=>x.level==='watch').length;
  if($('#anomalyCount'))$('#anomalyCount').textContent=anomalies.length;
  if($('#anomalyCritical'))$('#anomalyCritical').textContent=critical;
  if($('#anomalyWarning'))$('#anomalyWarning').textContent=warning;
  if($('#anomalyWatch'))$('#anomalyWatch').textContent=watch;
  const status=$('#anomalyStatus')&&$('#anomalyStatus').parentElement;
  if($('#anomalyStatus'))$('#anomalyStatus').textContent=critical?'ATTENTION':warning?'DEGRADED':watch?'WATCH':'NORMAL';
  if(status)status.className='anomaly-status '+(critical?'bad':warning?'warn':'good');
  if(!anomalies.length){
    list.innerHTML='<div class="anomaly-empty">현재 선택한 분석 범위에서 이상 신호가 감지되지 않았습니다.</div>';
    return;
  }
  list.innerHTML=anomalies.map(a=>{
    const click=a.runIndex!==undefined?' data-anomaly-run-index="'+a.runIndex+'" class="anomaly-item chart-clickable"':' class="anomaly-item"';
    const time=String(a.time||'—').replace('T',' ').slice(0,16);
    return '<div'+click+'><span class="anomaly-level '+a.level+'">'+a.level.toUpperCase()+'</span><time>'+time+'</time><div class="anomaly-copy"><b>'+a.title+'</b><small>'+a.detail+'</small></div><span class="anomaly-value '+(a.level==='critical'?'bad':a.level==='warning'?'warn':'info')+'">'+a.value+'</span></div>';
  }).join('');
}

function renderTelemetry(){renderAdvancedTelemetry();renderLongRangeAnalysis();renderAnomalyCenter();
  const usage=telemetryState.usage;
  const longRangeOutput=telemetryState.filter.range==='7d'||telemetryState.filter.range==='30d';
  const histOutput=longRangeOutput?aggregateHistory():null;
  const visibleRuns=filteredTelemetryRuns(),runCounts={};
  visibleRuns.forEach(x=>{if(x.series)runCounts[x.series]=(runCounts[x.series]||0)+1});
  const histCounts={};if(histOutput)(histOutput.series||[]).forEach(x=>histCounts[x.name]=x.runs||0);
  const outputSeries=(telemetryState.filter.series==='all'?monitored:[telemetryState.filter.series]).map(name=>({name,todayCount:longRangeOutput?(histCounts[name]||0):(runCounts[name]||0)}));
  if(outputSeries.length){
    const total=outputSeries.reduce((a,x)=>a+(Number(x.todayCount)||0),0);
    if($('#outputChartTotal'))$('#outputChartTotal').textContent=total;
    if($('#seriesOutputChart'))$('#seriesOutputChart').innerHTML=outputBarsSvg(outputSeries,[]);
  }
  if(usage){
    const longRange=telemetryState.filter.range==='7d'||telemetryState.filter.range==='30d';
    const hist=longRange?aggregateHistory():null;
    const s=usage.summary||{},runs=filteredTelemetryRuns();updateAnalysisContext(longRange&&hist?hist.runs:runs);
    const durations=longRange&&hist?hist.days.map(x=>Number(x.avgElapsed)).filter(Number.isFinite):runs.map(x=>Number(x.elapsedSeconds)).filter(Number.isFinite);
    const avg=durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null;
    const sorted=[...durations].sort((a,b)=>a-b);
    const p95=sorted.length?sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)]:null;
    const peak=sorted.length?sorted[sorted.length-1]:null;
    const verified=longRange&&hist?hist.verified:runs.filter(x=>x.driveVerified===true).length,baseRuns=longRange&&hist?hist.runs:runs.length,driveRate=baseRuns?pct(verified,baseRuns):null;
    const filteredSuccess=longRange&&hist?hist.success:runs.filter(x=>x.result==='success').length; const successRate=baseRuns?(filteredSuccess/baseRuns*100):NaN;
    if($('#telemetryAvgRuntime'))$('#telemetryAvgRuntime').textContent=avg===null?'—':Math.round(avg)+'s';
    if($('#telemetryPeakRuntime'))$('#telemetryPeakRuntime').textContent=p95===null?'—':Math.round(p95)+'s / '+Math.round(peak)+'s';
    if($('#telemetrySuccessRate'))$('#telemetrySuccessRate').textContent=Number.isFinite(successRate)?successRate.toFixed(1)+'%':'—';
    if($('#telemetryDriveRate'))$('#telemetryDriveRate').textContent=driveRate===null?'—':driveRate+'%';
    if($('#runtimeSpark'))$('#runtimeSpark').innerHTML=sparkSvg(durations.slice(0,16).reverse());
    if($('#peakSpark'))$('#peakSpark').innerHTML=sparkSvg(durations.slice(0,8).reverse().map((v,i,a)=>Math.max(...a.slice(0,i+1))));
    if($('#successGaugeMini'))$('#successGaugeMini').innerHTML=gaugeHtml(Number.isFinite(successRate)?successRate:0,filteredSuccess+' / '+runs.length+' success');
    if($('#driveGaugeMini'))$('#driveGaugeMini').innerHTML=gaugeHtml(driveRate||0,verified+' verified');
    if($('#runtimeTrendChart'))$('#runtimeTrendChart').innerHTML=longRange&&hist?historyRuntimeSvg(hist.days):runtimeTrendSvg(runs);
    if($('#runtimeChartAvg'))$('#runtimeChartAvg').textContent=avg===null?'—':Math.round(avg)+'s';
    if($('#runtimeChartRange'))$('#runtimeChartRange').textContent=longRange&&hist?(hist.days.length+' DAYS · '+hist.runs+' RUNS'):(runs.length+' AVAILABLE RUNS');
    if($('#telemetryWindow'))$('#telemetryWindow').textContent='RECENT '+runs.length+' RUNS';
    const series=longRange&&hist?hist.series:filteredSeriesStats();
    if($('#reliabilityChartRuns'))$('#reliabilityChartRuns').textContent=series.reduce((a,x)=>a+(Number(x.runs)||0),0);
    const rates=series.map(x=>x.runs?Math.round((x.success||0)/x.runs*100):0);
    const ravg=rates.length?Math.round(rates.reduce((a,b)=>a+b,0)/rates.length):null;
    if($('#reliabilityChartAvg'))$('#reliabilityChartAvg').textContent=ravg===null?'—':'AVG '+ravg+'%';
    if($('#reliabilityChart'))$('#reliabilityChart').innerHTML=series.length?series.map(x=>{const rate=x.runs?Math.round((x.success||0)/x.runs*100):0;return '<div class="matrix-row"><span>'+x.name+'</span><div class="matrix-track"><i style="width:'+rate+'%"></i></div><b class="'+(rate>=95?'good':rate>=80?'warn':'bad')+'">'+rate+'%</b></div>'}).join(''):'<p class="muted">신뢰도 데이터가 없습니다.</p>';
  }
  const github=telemetryState.github;
  if(github){
    const g=github.githubDeploy||{},runs=g.recentRuns||[];
    const success=runs.filter(x=>x.conclusion==='success').length;
    const cancelled=runs.filter(x=>x.conclusion==='cancelled').length;
    const failed=runs.filter(x=>x.status==='completed'&&x.conclusion&&!['success','cancelled'].includes(x.conclusion)).length;
    const running=runs.filter(x=>x.status!=='completed').length;
    const total=Math.max(1,runs.length);
    if($('#deployChartWindow'))$('#deployChartWindow').textContent=runs.length+' RUNS';
    if($('#deployChartSummary'))$('#deployChartSummary').textContent=success+' SUCCESS · '+cancelled+' SUPERSEDED · '+failed+' FAILED';
    if($('#deployOutcomeChart'))$('#deployOutcomeChart').innerHTML='<div class="deploy-stack"><i class="success" style="width:'+pct(success,total)+'%"></i><i class="cancelled" style="width:'+pct(cancelled,total)+'%"></i><i class="failed" style="width:'+pct(failed,total)+'%"></i><i class="running" style="width:'+pct(running,total)+'%"></i></div><div class="deploy-legend"><div><span>SUCCESS</span><b class="good">'+success+'</b></div><div><span>SUPERSEDED</span><b>'+cancelled+'</b></div><div><span>FAILED</span><b class="'+(failed?'bad':'good')+'">'+failed+'</b></div><div><span>RUNNING</span><b class="'+(running?'warn':'neutral')+'">'+running+'</b></div></div>';
  }
}

function renderTodaySummary(){
  const auto=todayOpsState.autoCount,manual=todayOpsState.manualCount,updated=todayOpsState.manualUpdated,total=todayOpsState.manualTotal,failed=todayOpsState.failed,verified=todayOpsState.driveVerified,runs=todayOpsState.autoRuns;
  if($('#todayAutoCount'))$('#todayAutoCount').textContent=auto??'—';
  if($('#todayAutoSub'))$('#todayAutoSub').textContent=(auto??'—')+' artworks · 8 series';
  if($('#todayManualCount'))$('#todayManualCount').textContent=manual??'—';
  if($('#todayManualSub'))$('#todayManualSub').textContent=(manual??'—')+' artworks · '+(total??5)+' series';
  if($('#todayManualUpdated'))$('#todayManualUpdated').textContent=updated===null?'—':updated+' / '+(total??5);
  if($('#todayFailed'))$('#todayFailed').textContent=failed??'—';
  if($('#todayDriveVerified'))$('#todayDriveVerified').textContent=verified===null?'—':verified+' / '+(runs??'—');
  if($('#todaySummaryState')){
    const ready=[auto,manual,updated,failed,verified].every(v=>v!==null);
    const issue=ready&&(failed>0||(runs!==null&&verified<runs));
    $('#todaySummaryState').textContent=!ready?'SYNCING':issue?'CHECK':'OPERATIONAL';
    $('#todaySummaryState').className=issue?'bad':ready?'good':'neutral';
  }
}
function renderAlertCenter(){
  const box=$('#alertCenter');if(!box)return;
  const issues=[];
  if(alertState.script==='error')issues.push({level:'error',title:'Apps Script 실행 오류',message:'최근 Apps Script 실행 자체가 실패했습니다.',href:'#runtime'});
  else if(alertState.script==='warning')issues.push({level:'warning',title:'Apps Script 실행 경고',message:'최근 Apps Script 실행이 경고 상태입니다.',href:'#runtime'});
  if(alertState.schedule==='error')issues.push({level:'error',title:'자동화 슬롯 누락',message:'오늘 예정된 자동화 중 누락·중단·실패 슬롯이 있습니다.',href:'#delay'});
  else if(alertState.schedule==='warning')issues.push({level:'warning',title:'자동화 슬롯 진행 중',message:'오늘 자동화 슬롯 일부가 현재 진행 중입니다.',href:'#delay'});
  if(alertState.notion==='error')issues.push({level:'error',title:'Notion 동기화 오류',message:'최근 Notion 동기화가 실패했습니다.',href:'#notion'});
  if(alertState.deploy==='error')issues.push({level:'error',title:'배포 오류',message:'최근 GitHub Pages 배포 결과를 확인해야 합니다.',href:'#deploy'});
  else if(alertState.deploy==='warning')issues.push({level:'warning',title:'배포 진행 중',message:'GitHub Pages 배포가 아직 완료되지 않았습니다.',href:'#deploy'});
  if(alertState.drive==='error')issues.push({level:'error',title:'Drive 상태 오류',message:'자동화 상태 데이터를 정상적으로 불러오지 못했습니다.',href:'#series'});
  if(!issues.length){box.hidden=true;box.className='alert-center hidden';return}
  const first=issues.find(x=>x.level==='error')||issues[0];
  const errors=issues.filter(x=>x.level==='error').length;
  const warnings=issues.filter(x=>x.level==='warning').length;
  box.hidden=false;box.className='alert-center '+(first.level==='error'?'':'warn-state');
  const scheduleOnly=issues.length===1&&alertState.schedule==='error'&&alertState.script!=='error'&&alertState.notion!=='error'&&alertState.deploy!=='error'&&alertState.drive!=='error';
  $('#alertTitle').textContent=scheduleOnly?'AUTOMATION ALERT · 1 ISSUE':errors?('SYSTEM ALERT · '+errors+' ERROR'+(errors>1?'S':'')):('SYSTEM NOTICE · '+warnings+' WARNING'+(warnings>1?'S':''));
  $('#alertMessage').textContent=issues.map(x=>x.title).join(' · ');
  $('#alertAction').href=first.href;
}
function serviceHealth(series){const active=series.filter(x=>x.driveStatus==='ok').length;return series.length?Math.round(active/series.length*100):0}
function computeOperationalSignals(){
  const usage=telemetryState.usage||{},all=(usage.recentRuns||[]);
  const cutoff=Date.now()-24*60*60*1000;
  const runs=all.filter(x=>{const d=parseRunDate(x.time);return d&&d.getTime()>=cutoff});
  if(!runs.length){
    systemHealthState.reliability=null;
    systemHealthState.performance=null;
    systemHealthState.delivery=null;
    return;
  }
  const success=runs.filter(x=>x.result==='success').length;
  const driveOk=runs.filter(x=>x.driveVerified===true).length;
  const failures=runs.filter(x=>x.result==='failed').length;
  const regens=runs.reduce((a,x)=>a+(Number(x.regenerations)||0),0);
  const delays=runs.map(x=>Number(x.startDelaySeconds)).filter(Number.isFinite);
  const severeDelays=delays.filter(x=>x>300).length;
  const durations=runs.map(x=>Number(x.elapsedSeconds)).filter(Number.isFinite);
  const seriesStats=(usage.series||[]).filter(x=>Number.isFinite(Number(x.avgElapsed))&&Number(x.avgElapsed)>0);
  const spikeCount=runs.filter(run=>{
    const e=Number(run.elapsedSeconds);if(!Number.isFinite(e))return false;
    const s=seriesStats.find(x=>x.name===run.series);if(!s)return false;
    const avg=Number(s.avgElapsed);
    return e>avg*1.5&&e-avg>60;
  }).length;

  const successRate=success/runs.length*100;
  const driveRate=driveOk/runs.length*100;
  const reliabilityPenalty=failures*14+regens*3+(100-driveRate)*0.35;
  systemHealthState.reliability=clamp(Math.round(successRate-reliabilityPenalty),0,100);

  const delayPenalty=severeDelays*9;
  const spikePenalty=spikeCount*7;
  systemHealthState.performance=clamp(100-delayPenalty-spikePenalty,0,100);

  const deliveryBase=(systemHealthState.deploy??100);
  systemHealthState.delivery=clamp(Math.round(deliveryBase*0.7+driveRate*0.3),0,100);
}
function updateOverallHealth(){
  computeOperationalSignals();
  const coreValues=[systemHealthState.drive,systemHealthState.script,systemHealthState.notion,systemHealthState.deploy].filter(v=>typeof v==='number');
  if(!coreValues.length)return;
  const core=Math.round(coreValues.reduce((a,b)=>a+b,0)/coreValues.length);
  const reliability=typeof systemHealthState.reliability==='number'?systemHealthState.reliability:core;
  const performance=typeof systemHealthState.performance==='number'?systemHealthState.performance:core;
  const delivery=typeof systemHealthState.delivery==='number'?systemHealthState.delivery:core;
  const score=Math.round(core*0.55+reliability*0.20+performance*0.15+delivery*0.10);

  $('#healthScore').textContent=score;
  $('#healthLine').style.width=score+'%';
  if($('#healthCore'))$('#healthCore').textContent=core+'%';
  if($('#healthReliability'))$('#healthReliability').textContent=reliability+'%';
  if($('#healthPerformance'))$('#healthPerformance').textContent=performance+'%';
  if($('#healthDelivery'))$('#healthDelivery').textContent=delivery+'%';

  let badge='OPERATIONAL',cls='good',copy='핵심 서비스와 최근 24시간 자동화 품질이 정상 범위입니다.';
  if(score<95&&score>=80){badge='DEGRADED';cls='warn';copy='최근 24시간 실행 품질 또는 일부 서비스에 경미한 저하가 감지되었습니다.'}
  if(score<80){badge='ATTENTION';cls='bad';copy='실패 · 지연 · Runtime 이상 · Drive 검증 또는 핵심 서비스 상태를 확인해야 합니다.'}
  $('#healthBadge').textContent=badge;
  $('#healthBadge').className='status '+cls;
  $('#healthCopy').textContent=copy;
}
function renderStatus(s){const all=(s.series||[]).filter(x=>x.name!=='자동화 상태');const target=monitored.map(n=>all.find(x=>x.name===n)).filter(Boolean);const score=serviceHealth(target);systemHealthState.drive=score;alertState.drive=score===100?'ok':'warning';updateOverallHealth();renderAlertCenter();$('#todayTotal').textContent=(target.reduce((a,x)=>a+(x.todayCount||0),0)+(s.manualTodayTotal??0));$('#archiveTotal').textContent=all.reduce((a,x)=>a+(x.totalCount||0),0);$('#seriesTotal').textContent=all.length;$('#lastSync').textContent='SYNC '+fmtDate(s.updatedAt);$('#scheduleLabel').textContent=s.scheduleSummary||('SCHEDULE '+(s.schedule||[]).join(' / '));const manualFallback=[['유영','유영'],['여운','여운'],['포근','포근'],['붓결','붓결'],['몽화','뭉화']].map(([folder,display])=>{const x=all.find(v=>v.name===folder);return x?{name:display,folderName:folder,todayCount:x.todayCount||0,updatedToday:(x.todayCount||0)>0,lastFile:x.lastFile,lastSavedAt:x.lastSavedAt,totalCount:x.totalCount||0,driveStatus:x.driveStatus}:null}).filter(Boolean);const manual=(s.manualSeries&&s.manualSeries.length?s.manualSeries:manualFallback);telemetryState.autoSeries=target;telemetryState.manualSeries=manual;renderTelemetry();const manualToday=manual.reduce((a,x)=>a+(x.todayCount||0),0);const manualUpdated=manual.filter(x=>x.updatedToday).length;const autoToday=target.reduce((a,x)=>a+(x.todayCount||0),0);todayOpsState.autoCount=autoToday;todayOpsState.manualCount=s.manualTodayTotal??manualToday;todayOpsState.manualUpdated=s.manualUpdatedToday??manualUpdated;todayOpsState.manualTotal=manual.length;renderTodaySummary();if($('#manualTodayTotal'))$('#manualTodayTotal').textContent=s.manualTodayTotal??manualToday;if($('#manualUpdatedToday'))$('#manualUpdatedToday').textContent=(s.manualUpdatedToday??manualUpdated)+' / '+manual.length;if($('#manualSeriesTotal'))$('#manualSeriesTotal').textContent=manual.length;if($('#manualSummary'))$('#manualSummary').textContent='TODAY '+manualToday+' WORK'+(manualToday===1?'':'S');if($('#manualSeriesGrid'))$('#manualSeriesGrid').innerHTML=manual.map(x=>`<article class="series-card manual-card"><div class="row"><b>${x.name}</b><span class="manual-state ${x.updatedToday?'good':'neutral'}">${x.updatedToday?'UPDATED':'NO UPDATE'}</span></div><strong>${x.todayCount??0}<small> TODAY</small></strong><small>${x.lastFile||'최근 작품 없음'}</small><small>${fmtDate(x.lastSavedAt)} · TOTAL ${x.totalCount??0}</small></article>`).join('')||'<p class="muted">수동 시리즈 데이터가 없습니다.</p>';$('#seriesGrid').innerHTML=target.map(x=>`<article class="series-card"><div class="row"><b>${x.name}</b><i class="dot"></i></div><strong>${x.todayCount??0}<small> TODAY</small></strong><small>${x.lastFile||'최근 파일 없음'}</small><small>${fmtDate(x.lastSavedAt)} · TOTAL ${x.totalCount??0}</small></article>`).join('');const pipe=[['Drive folders',target.filter(x=>x.driveStatus==='ok').length,target.length],['Today output',target.reduce((a,x)=>a+(x.todayCount||0),0),Math.max(1,(s.dailyPlanned||16))],['Series reporting',target.filter(x=>x.lastResult==='success').length,target.length],['Archive index',all.filter(x=>x.totalCount>0).length,all.length]];$('#pipeline').innerHTML=pipe.map(([n,v,m])=>`<div class="pipe-row"><b>${n}</b><div class="bar"><i style="width:${Math.min(100,Math.round(v/m*100))}%"></i></div><span>${v} / ${m}</span></div>`).join('');const events=[...all].filter(x=>x.lastSavedAt).sort((a,b)=>new Date(b.lastSavedAt)-new Date(a.lastSavedAt)).slice(0,10);$('#activityList').innerHTML=events.map(x=>`<div class="event"><time>${new Date(x.lastSavedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}</time><span class="tag">${x.name}</span><b>${x.lastFile}</b><em>DRIVE OK</em></div>`).join('')||'<p class="muted">최근 이벤트가 없습니다.</p>'}
function renderUsage(d){telemetryState.usage=d;updateOverallHealth();renderTelemetry();const s=d.summary||{};const delays=(d.recentRuns||[]).filter(x=>x.scheduledTime&&x.startDelaySeconds!==null&&x.startDelaySeconds!==undefined);const delayVals=delays.map(x=>Number(x.startDelaySeconds)).filter(Number.isFinite);const delayAvg=delayVals.length?Math.round(delayVals.reduce((a,b)=>a+b,0)/delayVals.length):null;const delayMax=delayVals.length?Math.max(...delayVals):null;const delayWorst=delayMax===null?null:delays.find(x=>Number(x.startDelaySeconds)===delayMax);if($('#delaySamples'))$('#delaySamples').textContent=delays.length;if($('#delayAverage'))$('#delayAverage').textContent=delayAvg===null?'—':delayAvg+'s';if($('#delayMax'))$('#delayMax').textContent=delayMax===null?'—':delayMax+'s';if($('#delayWorst'))$('#delayWorst').textContent=delayWorst?delayWorst.series:'—';if($('#delayState'))$('#delayState').textContent=delays.length?'LIVE':'WAITING DATA';if($('#delayCopy'))$('#delayCopy').textContent=delays.length?'예약 지연 '+delays.length+'건 집계 중':'다음 자동 실행부터 예약 지연을 집계합니다.';if($('#delayRunTable'))$('#delayRunTable').innerHTML=delays.length?delays.slice(0,8).map(x=>{const n=Number(x.startDelaySeconds||0),cl=n>300?'bad':n>60?'warn':'good';return `<div class="delay-row"><b>${x.series||'—'}</b><span>${String(x.scheduledTime||'').slice(5,16)||'—'}</span><strong class="${cl}">+${n}s</strong></div>`}).join(''):'<p class="muted">예약시각 데이터가 쌓이면 자동 표시됩니다.</p>';const todayKey=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});const todayRuns=(d.recentRuns||[]).filter(x=>{if(!x.time)return false;const dt=new Date(String(x.time).replace(' ','T')+'+09:00');return !isNaN(dt)&&dt.toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'})===todayKey});todayOpsState.autoRuns=todayRuns.length;todayOpsState.failed=todayRuns.filter(x=>x.result==='failed').length;todayOpsState.driveVerified=todayRuns.filter(x=>x.driveVerified===true).length;renderTodaySummary();$('#logSuccessRate').textContent=(s.successRate??0).toFixed(1)+'%';$('#logRuns').textContent=s.runs??0;$('#logFailed').textContent=s.failed??0;$('#logRegens').textContent=s.regenerations??0;$('#usageSync').textContent='LOG SYNC '+fmtDate(d.generatedAt);$('#reliability').innerHTML=(d.series||[]).map(x=>{const rate=x.runs?Math.round(x.success/x.runs*100):0;return `<div class="rel-row"><span>${x.name}</span><div class="bar"><i style="width:${rate}%"></i></div><b>${rate}%</b><small>${x.avgElapsed?Math.round(x.avgElapsed)+'s':'—'}</small></div>`}).join('');$('#runTable').innerHTML=(d.recentRuns||[]).map(x=>`<div class="run-row"><time>${x.time.slice(5,16)}</time><b>${x.series}</b><span class="${x.result==='success'?'good':'bad'}">${x.result.toUpperCase()}</span><small>GEN ${x.generationAttempts} · RE ${x.regenerations} · ${x.elapsedSeconds??'—'}s</small></div>`).join('')}

function renderDailySlotDiagnosis(d){
  const diag=d&&d.automationDailyDiagnosis;
  if(!diag){
    if($('#slotDiagState'))$('#slotDiagState').textContent='WAITING DATA';
    if($('#slotGrid'))$('#slotGrid').innerHTML='<p class="muted">Apps Script 진단 데이터가 생성되면 자동 표시됩니다.</p>';
    return null;
  }

  const n=k=>Number(diag[k]||0);
  if($('#slotPlanned'))$('#slotPlanned').textContent=n('planned')||16;
  if($('#slotSuccess'))$('#slotSuccess').textContent=n('success');
  if($('#slotFailed'))$('#slotFailed').textContent=n('failed');
  if($('#slotStalled'))$('#slotStalled').textContent=n('stalled');
  if($('#slotMissed'))$('#slotMissed').textContent=n('missed');
  if($('#slotRunning'))$('#slotRunning').textContent=n('running');
  if($('#slotPending'))$('#slotPending').textContent=n('pending');

  const state=String(diag.status||'pending').toUpperCase();
  if($('#slotDiagState')){
    $('#slotDiagState').textContent=state+' · '+fmtDate(diag.checkedAt);
    $('#slotDiagState').className='section-state '+(state==='ERROR'?'bad':state==='RUNNING'?'warn':'good');
  }

  const slots=Array.isArray(diag.slots)?diag.slots:[];
  if($('#slotGrid')){
    $('#slotGrid').innerHTML=slots.map(x=>{
      const status=String(x.status||'PENDING').toLowerCase();
      const delay=x.startDelaySeconds!==null&&x.startDelaySeconds!==undefined?' · +'+x.startDelaySeconds+'s':'';
      const elapsed=x.elapsedMinutes!==null&&x.elapsedMinutes!==undefined?' · '+x.elapsedMinutes+'m':'';
      return '<article class="slot-card">'+
        '<div class="slot-top"><b>'+String(x.series||'—')+'</b><span class="slot-time">'+String(x.scheduledTime||'—')+'</span></div>'+
        '<span class="slot-state '+status+'">'+String(x.status||'PENDING')+'</span>'+
        '<small>ROW '+(x.logRow||'—')+delay+elapsed+'</small>'+
        '<em title="'+String(x.diagnosis||'').replace(/"/g,'&quot;')+'">'+String(x.diagnosis||'—')+'</em>'+
      '</article>';
    }).join('')||'<p class="muted">진단 슬롯 데이터가 없습니다.</p>';
  }

  const bad=n('failed')+n('stalled')+n('missed');
  const slotHealth=bad>0?55:(n('running')>0?92:100);
  return {bad,slotHealth,status:state};
}

function renderScript(d){const a=d.appsScript||{},r=a.lastRun||{},skipped=r.result==='skipped'||a.busyOrSkipped===true,runSuccess=r.result==='success'&&Number(a.consecutiveFailures||0)===0,runWarning=skipped||r.result==='warning';$('#scriptBadge').textContent=skipped?'BUSY / SKIPPED':runSuccess?'OPERATIONAL':runWarning?'WARNING':'ERROR';$('#scriptBadge').className='status '+(skipped?'neutral':runSuccess?'good':runWarning?'warn':'bad');$('#scriptFunction').textContent=r.functionName||'—';$('#scriptResult').textContent=(r.result||'—').toUpperCase();$('#scriptResult').className=skipped?'neutral':runSuccess?'good':runWarning?'warn':'bad';$('#scriptDuration').textContent=Number.isFinite(r.durationMs)?(r.durationMs/1000).toFixed(2)+'s':'—';$('#scriptFailures').textContent=a.consecutiveFailures??'—';$('#scriptStarted').textContent=fmtDate(r.startedAt);$('#scriptFinished').textContent=fmtDate(r.finishedAt);$('#scriptSync').textContent=fmtDate(d.updatedAt);$('#scriptError').textContent=skipped?(a.busyReason||r.error||'중복 실행 방지로 이번 회차를 건너뜀'):(r.error||'No runtime error reported.');$('#scriptError').className=skipped?'muted':r.error?'bad':'muted';$('#scriptService').textContent=skipped?'BUSY':runSuccess?'CONNECTED':runWarning?'WARNING':'ERROR';$('#scriptService').className='pill '+(skipped?'neutral':runSuccess?'good':runWarning?'warn':'bad');systemHealthState.script=skipped?100:runSuccess?100:runWarning?75:0;alertState.script=skipped?'ok':runSuccess?'ok':runWarning?'warning':'error';alertState.schedule='ok';const slotDiag=renderDailySlotDiagnosis(d);if(slotDiag){systemHealthState.script=Math.min(systemHealthState.script,slotDiag.slotHealth);if(slotDiag.bad>0)alertState.schedule='error';else if(slotDiag.status==='RUNNING')alertState.schedule='warning';}updateOverallHealth();renderAlertCenter()}
function renderNotion(d){const n=d.notionSync||{},ok=n.lastResult==='success';$('#notionBadge').textContent=ok?'OPERATIONAL':n.lastResult?'ERROR':'NO DATA';$('#notionBadge').className='status '+(ok?'good':n.lastResult?'bad':'neutral');$('#notionResult').textContent=(n.lastResult||'—').toUpperCase();$('#notionResult').className=ok?'good':n.lastResult?'bad':'';$('#notionSeries').textContent=n.lastSeries||'—';$('#notionDuration').textContent=Number.isFinite(n.durationMs)?(n.durationMs/1000).toFixed(2)+'s':'—';$('#notionFailures').textContent=n.consecutiveFailures??'—';$('#notionArtwork').textContent=n.lastArtwork||'—';$('#notionStarted').textContent=fmtDate(n.startedAt);$('#notionFinished').textContent=fmtDate(n.finishedAt);$('#notionError').textContent=n.error||'No Notion sync error reported.';$('#notionError').className=n.error?'bad':'muted';$('#notionService').textContent=ok?'CONNECTED':n.lastResult?'ERROR':'NO DATA';$('#notionService').className='pill '+(ok?'good':n.lastResult?'bad':'neutral');systemHealthState.notion=ok?100:(n.lastResult?0:50);alertState.notion=ok?'ok':(n.lastResult?'error':'warning');updateOverallHealth();renderAlertCenter()}
function renderGithubSnapshot(d){
  telemetryState.github=d;renderTelemetry();
  const g=d.githubDeploy||{},runs=g.recentRuns||[],commits=g.recentCommits||[],latest=g.latestRun||runs[0]||null;
  $('#commitCount').textContent=commits.length||'—';
  $('#commits').innerHTML=commits.length?commits.slice(0,6).map(c=>`<div class="commit"><b>${c.message||'Commit'}</b><small>${String(c.sha||'').slice(0,7)} · ${fmtDate(c.date)}</small></div>`).join(''):'<p class="muted">저장된 GitHub 스냅샷이 없습니다.</p>';
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
  const todayCount=commits.filter(c=>c.date&&new Date(c.date).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'})===today).length;
  $('#todayCommits').textContent=todayCount;
  $('#deployCancelled').textContent=runs.filter(x=>x.conclusion==='cancelled').length;
  $('#deployResult').textContent=latest?(latest.conclusion||latest.status||'—').toUpperCase():'—';
  $('#deploySha').textContent=latest&&latest.head_sha?latest.head_sha.slice(0,7):'—';
  $('#deployStarted').textContent=latest?fmtDate(latest.run_started_at||latest.created_at):'—';
  $('#deployFinished').textContent=latest?fmtDate(latest.updated_at):'—';
  const dur=latest&&latest.updated_at&&(latest.run_started_at||latest.created_at)?Math.max(0,(new Date(latest.updated_at)-new Date(latest.run_started_at||latest.created_at))/1000):null;
  $('#deployDuration').textContent=dur!==null?Math.round(dur)+'s':'—';
  $('#deployMessage').textContent=latest&&latest.message?latest.message:(commits[0]&&commits[0].message)||'저장된 커밋 정보 없음';
  const deployOk=latest&&latest.status==='completed'&&latest.conclusion==='success';
  const deploying=latest&&latest.status!=='completed';
  const deployFailed=latest&&latest.status==='completed'&&latest.conclusion&&!['success','cancelled'].includes(latest.conclusion);
  $('#deployBadge').textContent=deployOk?'OPERATIONAL':deploying?'DEPLOYING':deployFailed?'ATTENTION':'OPERATIONAL';
  $('#deployBadge').className='status '+(deployFailed?'bad':deploying?'neutral':'good');
  $('#deployHealth').textContent=deployOk?'저장된 최신 GitHub Pages 배포가 정상 완료되었습니다.':deploying?'GitHub Pages 배포가 진행 중입니다. 정상적인 전환 상태이며 경고로 처리하지 않습니다.':deployFailed?'최신 배포 결과를 확인해야 합니다.':'최근 배포가 교체되었거나 취소되었으며 오류 상태는 아닙니다.';
  $('#deployHealth').className=deployFailed?'bad':deploying?'neutral':'good';
  $('#githubService').textContent=deployFailed?'CHECK DEPLOY':deploying?'DEPLOYING':'CONNECTED';
  $('#githubService').className='pill '+(deployFailed?'bad':deploying?'neutral':'good');
  systemHealthState.deploy=deployFailed?0:deploying?95:100;
  alertState.deploy=deployFailed?'error':'ok';
  updateOverallHealth();renderAlertCenter();
}
async function loadStatus(){try{const r=await fetch(ART_DATA_BASE+'automation-status.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('status');renderStatus(await r.json());$('#driveService').textContent='CONNECTED'}catch(e){$('#healthBadge').textContent='DATA ERROR';$('#healthBadge').className='status bad';$('#healthCopy').textContent='automation-status.json을 불러오지 못했습니다.';$('#driveService').textContent='CHECK DATA';$('#driveService').className='pill bad';systemHealthState.drive=0;alertState.drive='error';updateOverallHealth();renderAlertCenter()}}
async function loadHistory(){
  const urls=[
    ART_DATA_BASE+'system-history.json?ts='+Date.now(),
    ART_DATA_BASE+'system-history.json?ts='+Date.now()
  ];
  let lastError=null;
  for(const url of urls){
    try{
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok)throw Error('history '+r.status);
      const d=await r.json();
      if(!d||!Array.isArray(d.daily))throw Error('history schema');
      telemetryState.history=d;
      renderTelemetry();
      return true;
    }catch(e){lastError=e}
  }
  console.warn('SYSTEM history fetch failed; preserving previous history',lastError);
  if(!telemetryState.history){
    const box=$('#longRangeAnalysis');
    if(box&&!box.hidden){
      if($('#longRangeCoverage'))$('#longRangeCoverage').textContent='HISTORY RETRY';
    }
  }
  renderTelemetry();
  return false;
}
async function loadUsage(){try{const r=await fetch(ART_DATA_BASE+'system-usage.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('usage');renderUsage(await r.json())}catch(e){$('#usageSync').textContent='LOG DATA ERROR';$('#runTable').innerHTML='<p class="muted">진단 로그 데이터를 불러오지 못했습니다.</p>'}}
async function loadScript(){try{const r=await fetch(ART_DATA_BASE+'system-status.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('script');const d=await r.json();renderScript(d);renderNotion(d);renderGithubSnapshot(d)}catch(e){$('#scriptBadge').textContent='DATA ERROR';$('#scriptBadge').className='status bad';$('#scriptService').textContent='UNAVAILABLE';$('#scriptService').className='pill bad';$('#scriptError').textContent='system-status.json을 불러오지 못했습니다.';systemHealthState.script=0;systemHealthState.notion=0;alertState.script='error';alertState.notion='error';updateOverallHealth();renderAlertCenter()}}
async function loadOpsEvents(){try{const r=await fetch(ART_DATA_BASE+'system-events.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('events');const d=await r.json();telemetryState.events=d.events||[];renderAdvancedTelemetry()}catch(e){telemetryState.events=[];renderAdvancedTelemetry()}}
async function loadGithub(){try{const r=await fetch(ART_DATA_BASE+'system-status.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('status');renderGithubSnapshot(await r.json())}catch(e){$('#githubService').textContent='UNAVAILABLE';$('#githubService').className='pill warn';$('#deployBadge').textContent='DATA ERROR';$('#deployBadge').className='status bad';$('#deployHealth').textContent='로컬 SYSTEM 상태 파일을 불러오지 못했습니다.';systemHealthState.deploy=0;alertState.deploy='error';updateOverallHealth();renderAlertCenter()}}
function setupTelemetryInteractions(){
  syncTelemetryControls();
  document.querySelectorAll('#rangeControls button').forEach(btn=>btn.addEventListener('click',()=>{
    telemetryState.filter.range=btn.dataset.range||'24h';
    document.querySelectorAll('#rangeControls button').forEach(x=>x.classList.toggle('active',x===btn));
    persistTelemetryFilter();renderTelemetry();
  }));
  if($('#telemetrySeries'))$('#telemetrySeries').addEventListener('change',e=>{telemetryState.filter.series=e.target.value||'all';telemetryState.hiddenSeries.clear();persistTelemetryFilter();renderTelemetry()});
  document.querySelectorAll('#multiMetricSwitch button').forEach(btn=>btn.addEventListener('click',()=>{telemetryState.multiMetric=btn.dataset.metric||'avgElapsed';renderLongRangeAnalysis()}));
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-multi-series]');if(!b)return;
    const name=b.dataset.multiSeries;
    if(telemetryState.hiddenSeries.has(name))telemetryState.hiddenSeries.delete(name);else telemetryState.hiddenSeries.add(name);
    renderLongRangeAnalysis();
  });
  if($('#runDetailClose'))$('#runDetailClose').addEventListener('click',()=>{$('#runDetailDrawer').classList.remove('open');$('#runDetailDrawer').setAttribute('aria-hidden','true')});
  document.addEventListener('click',e=>{
    const p=e.target.closest('[data-run-index]');if(p)openRunDetail((telemetryState.visibleRuns||[])[Number(p.dataset.runIndex)]);
    const q=e.target.closest('[data-quality-index]');if(q)openRunDetail((telemetryState.visibleQualityRuns||[])[Number(q.dataset.qualityIndex)]);
    const a=e.target.closest('[data-anomaly-run-index]');if(a)openRunDetail((telemetryState.anomalyRuns||[])[Number(a.dataset.anomalyRunIndex)]);
  });
}
setupTelemetryInteractions();
async function refresh(){const b=$('#refresh');b.disabled=true;b.textContent='↻ SYNCING';await Promise.all([loadStatus(),loadUsage(),loadHistory(),loadScript(),loadGithub(),loadOpsEvents()]);b.disabled=false;b.textContent='↻ REFRESH'}$('#refresh').addEventListener('click',refresh);refresh();setInterval(()=>Promise.all([loadStatus(),loadUsage(),loadHistory(),loadScript(),loadOpsEvents()]),60000);const navLinks=[...document.querySelectorAll('nav a')];
navLinks.forEach(a=>a.addEventListener('click',()=>{navLinks.forEach(x=>x.classList.remove('active'));a.classList.add('active')}));
const sectionMap=navLinks.map(a=>({a,id:a.getAttribute('href').slice(1),el:document.querySelector(a.getAttribute('href'))})).filter(x=>x.el);
const scrollSpy=new IntersectionObserver(entries=>{
  const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
  if(!visible)return;
  const item=sectionMap.find(x=>x.el===visible.target);if(!item)return;
  navLinks.forEach(x=>x.classList.toggle('active',x===item.a));
},{rootMargin:'-18% 0px -68% 0px',threshold:[0,.1,.25,.5]});
sectionMap.forEach(x=>scrollSpy.observe(x.el));
window.addEventListener('load',()=>document.body.classList.add('system-ready'));
