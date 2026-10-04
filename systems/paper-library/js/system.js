const PAPER_INDEX='https://raw.githubusercontent.com/tom981105-web/paper/main/data/index.json';
const API='https://api.github.com/repos/tom981105-web/paper';
const PAPER_DATA_BASE='https://raw.githubusercontent.com/tom981105-web/paper/main/data/';
const DAY=24*60*60*1000;
const $=id=>document.getElementById(id);
const fmt=n=>Number(n||0).toLocaleString('ko-KR');
let trendHistory=[];
let activeTrendRange=7;
const timeFmt=v=>v?new Intl.DateTimeFormat('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).format(new Date(v)):'—';

function clock(){ $('clock').textContent=new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).format(new Date()); }
setInterval(clock,1000);clock();

async function getJson(url){
  const r=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
  if(!r.ok) throw new Error(url+' HTTP '+r.status);
  return r.json();
}
function setSignal(id,textId,ok,text){ $(id).className='dot '+(ok?'ok':'fail'); $(textId).textContent=text; }



async function getCommitHistory(days=30){
  const since=new Date(Date.now()-days*DAY).toISOString();
  const all=[];
  for(let page=1;page<=4;page++){
    const rows=await getJson(API+'/commits?per_page=100&page='+page+'&since='+encodeURIComponent(since));
    all.push(...rows);
    if(rows.length<100)break;
  }
  return all;
}

function kstDayKey(value){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date(value));
  const obj=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return obj.year+'-'+obj.month+'-'+obj.day;
}

function buildTrend(history,days){
  const end=new Date();
  const rows=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date(end.getTime()-i*DAY);
    rows.push({key:kstDayKey(d),count:0,batches:0});
  }
  const byKey=Object.fromEntries(rows.map(r=>[r.key,r]));
  (history||[]).map(parseBatch).filter(Boolean).forEach(b=>{
    const key=kstDayKey(b.date);
    if(byKey[key]){
      byKey[key].count+=b.count;
      byKey[key].batches++;
    }
  });
  return rows;
}

function renderTrend(days=activeTrendRange){
  activeTrendRange=days;
  const rows=buildTrend(trendHistory,days);
  const total=rows.reduce((s,r)=>s+r.count,0);
  const active=rows.filter(r=>r.count>0);
  const best=rows.reduce((a,b)=>b.count>a.count?b:a,{key:'—',count:0});
  const max=Math.max(...rows.map(r=>r.count),1);

  $('trendOutput').textContent=fmt(total);
  $('trendAverage').textContent=(total/Math.max(days,1)).toFixed(1);
  $('trendBest').textContent=best.count?best.key.slice(5)+' · '+best.count:'—';
  $('trendActiveDays').textContent=active.length+' / '+days;

  $('trendChart').innerHTML=rows.map(r=>{
    const pct=Math.max(1,(r.count/max)*100);
    return '<div class="trend-bar"><i style="height:'+pct+'%"></i><em>'+r.key+' · '+r.count+' papers / '+r.batches+' batches</em></div>';
  }).join('');

  const marks=days<=7?rows:rows.filter((_,i)=>i===0||i===rows.length-1||i%5===0);
  $('trendAxis').innerHTML='<span>'+rows[0].key.slice(5)+'</span><span>'+rows[Math.floor((rows.length-1)/2)].key.slice(5)+'</span><span>'+rows[rows.length-1].key.slice(5)+'</span>';

  document.querySelectorAll('.range-btn').forEach(btn=>{
    btn.classList.toggle('active',Number(btn.dataset.range)===days);
  });
}


function paperQualityScore(p){
  let score=100;
  const issues=[];
  if(!p.id){score-=18;issues.push('id');}
  if(!p.title&&!p.shortTitle&&!p.originalTitle){score-=18;issues.push('title');}
  if(!p.category){score-=15;issues.push('category');}
  if(!p.file){score-=18;issues.push('file');}
  if(!p.doi){score-=10;issues.push('doi');}
  if(!p.verified){score-=12;issues.push('verified');}
  const sc=Number(p.sectionCount);
  if(!Number.isFinite(sc)||sc<10||sc>20){score-=12;issues.push('sections');}
  const y=Number(p.year);
  if(!Number.isFinite(y)||y<1900||y>2100){score-=8;issues.push('year');}
  return {score:Math.max(0,score),issues};
}

function renderLatestQuality(papers){
  const sample=(papers||[]).slice(0,12);
  const rows=sample.map(p=>({paper:p,...paperQualityScore(p)}));
  const clean=rows.filter(x=>x.score>=95).length;
  const review=rows.length-clean;
  const avg=rows.length?Math.round(rows.reduce((s,x)=>s+x.score,0)/rows.length):0;

  $('latestQualityWindow').textContent=rows.length+' PAPERS';
  $('latestQualityClean').textContent=clean;
  $('latestQualityReview').textContent=review;
  $('latestQualityAvg').textContent=avg;
  $('latestQualityBadge').textContent=review?'REVIEW':'CLEAN';
  $('latestQualityBadge').className='state '+(review?'warn':'good');

  $('paperQualityList').innerHTML=rows.map(x=>{
    const p=x.paper;
    const state=x.score>=95?'good':x.score>=80?'warn':'bad';
    const label=x.score>=95?'CLEAN':x.score>=80?'REVIEW':'ATTENTION';
    return '<div class="paper-quality-row">'+
      '<span>'+String(p.category||'미분류')+'</span>'+
      '<b title="'+String(p.shortTitle||p.title||p.originalTitle||p.id||'').replace(/"/g,'&quot;')+'">'+String(p.shortTitle||p.title||p.originalTitle||p.id||'—')+'</b>'+
      '<strong>'+x.score+'</strong>'+
      '<em class="'+state+'">'+label+'</em>'+
    '</div>';
  }).join('')||'<p class="muted">최신 논문 데이터가 없습니다.</p>';
}

function renderFieldFlow(papers){
  const sample=(papers||[]).slice(0,60);
  const counts={};
  sample.forEach(p=>{const k=p.category||'미분류';counts[k]=(counts[k]||0)+1;});
  const rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const max=Math.max(1,...rows.map(x=>x[1]));
  $('fieldFlowSummary').textContent=sample.length+' LATEST';
  $('fieldFlowBars').innerHTML=rows.map(([name,count])=>{
    const pct=sample.length?Math.round(count/sample.length*100):0;
    return '<div class="field-flow-row"><span>'+name+'</span><div class="flow-bar"><i style="width:'+Math.max(2,count/max*100)+'%"></i></div><b>'+count+'</b><small>'+pct+'%</small></div>';
  }).join('');
  $('fieldFlowTop').textContent=rows.length?rows[0][0]+' · '+rows[0][1]+'편':'—';
}

function renderIncidentCenter(papers,commits,runs,audit){
  const now=Date.now();
  const batches=(commits||[]).map(parseBatch).filter(Boolean).sort((a,b)=>b.date-a.date);
  const last=batches[0]||null;
  const age=last?now-last.date.getTime():Infinity;

  const workflowRuns=(runs&&runs.workflow_runs)||[];
  const deployFailures=workflowRuns.filter(r=>
    r.status==='completed'&&['failure','timed_out','action_required','stale'].includes(String(r.conclusion||''))
  );

  const textPool=[
    ...(commits||[]).map(c=>(c.commit&&c.commit.message)||''),
    ...workflowRuns.map(r=>String(r.display_title||'')+' '+String(r.name||''))
  ].join('\n');
  const explicit429=/\b429\b|too many requests|rate limit(?:ed|ing)?/i.test(textPool);

  const anomalyTotal=audit
    ? audit.missingDoi+audit.duplicateDoi+audit.missingFields+audit.sectionAnomaly+audit.categoryAnomaly
    : 0;

  $('incidentGap').textContent=last?humanGap(age):'NO SIGNAL';
  $('incidentDeployFail').textContent=deployFailures.length;
  $('incidentData').textContent=anomalyTotal;
  $('incident429').textContent=explicit429?'DETECTED':'UNOBSERVED';
  $('incident429Copy').textContent=explicit429?'explicit public signal':'OpenAlex/Gemini 로그 미연결';

  const incidents=[];
  if(!last){
    incidents.push({level:'bad',title:'생성 신호 없음',detail:'논문 생성 커밋을 찾지 못했습니다.',time:'NOW'});
  }else if(age>4*60*60*1000){
    incidents.push({level:'bad',title:'자동 생성 장기 공백',detail:'마지막 생성 배치 이후 '+humanGap(age)+' 경과',time:timeFmt(last.date)});
  }else if(age>2.25*60*60*1000){
    incidents.push({level:'warn',title:'자동 생성 지연',detail:'평소 주기보다 생성 신호가 늦습니다 · '+humanGap(age),time:timeFmt(last.date)});
  }
  deployFailures.slice(0,4).forEach(r=>{
    incidents.push({level:'bad',title:'GitHub Pages 배포 실패',detail:String(r.display_title||r.name||'workflow')+' · '+String(r.conclusion||'failure').toUpperCase(),time:timeFmt(r.updated_at)});
  });
  if(anomalyTotal){
    incidents.push({level:audit.duplicateDoi||audit.missingFields?'bad':'warn',title:'논문 데이터 이상',detail:'인덱스 무결성 이상 합계 '+anomalyTotal+'건',time:'INDEX'});
  }
  if(explicit429){
    incidents.push({level:'warn',title:'HTTP 429 신호 감지',detail:'공개 GitHub 신호에서 429/rate-limit 문구 감지',time:'PUBLIC'});
  }else{
    incidents.push({level:'good',title:'HTTP 429 직접 계측 미연결',detail:'OpenAlex/Gemini Apps Script 로그가 연결되기 전에는 429를 추정하지 않습니다.',time:'INFO'});
  }
  if(!incidents.some(x=>x.level==='bad'||x.level==='warn')){
    incidents.unshift({level:'good',title:'관측 가능한 주요 장애 없음',detail:'생성 커밋·배포·인덱스 기준',time:'NOW'});
  }

  const bad=incidents.filter(x=>x.level==='bad').length;
  const warn=incidents.filter(x=>x.level==='warn').length;
  $('incidentCenterBadge').textContent=bad?'ATTENTION':warn?'WATCH':'CLEAR';
  $('incidentCenterBadge').className='state '+(bad?'bad':warn?'warn':'good');
  $('incidentCount').textContent=(bad+warn)+' ACTIVE';
  $('paperIncidentFeed').innerHTML=incidents.slice(0,8).map(x=>
    '<div class="paper-incident '+x.level+'"><span></span><div><b>'+x.title+'</b><small>'+x.detail+'</small></div><time>'+x.time+'</time></div>'
  ).join('');

  const anomalies=(audit&&audit.anomalies)||[];
  $('anomalyCount').textContent=anomalies.length+' ITEMS';
  $('anomalyList').innerHTML=anomalies.slice(0,10).map(x=>
    '<div class="anomaly-item"><span>'+String(x.category||'미분류')+'</span><div><b>'+String(x.title||x.id||'—')+'</b><small>'+x.reasons.join(' · ')+'</small></div></div>'
  ).join('')||'<div class="anomaly-item"><span>CLEAN</span><div><b>표시할 이상 논문 없음</b><small>현재 인덱스 규칙 기준</small></div></div>';
}

function auditIndex(papers){
  const expectedCats=new Set(['인공지능','전기','로봇·자동화','에너지·환경','건축·시설관리','도서관·문헌정보']);
  const seenDoi=new Set();
  let missingDoi=0,duplicateDoi=0,missingFields=0,sectionAnomaly=0,categoryAnomaly=0;
  const issues=[];
  const anomalies=[];

  papers.forEach((p,idx)=>{
    const reasons=[];
    const doi=String(p.doi||'').trim().toLowerCase();
    if(!doi){missingDoi++;reasons.push('DOI 누락');}
    else if(seenDoi.has(doi)){duplicateDoi++;reasons.push('DOI 중복');}
    else seenDoi.add(doi);

    const required=['id','category','title','file','sectionCount','year'];
    const missing=required.filter(k=>p[k]===undefined||p[k]===null||p[k]==='');
    if(missing.length){
      missingFields++;
      reasons.push('필수필드: '+missing.join(', '));
      if(issues.length<6)issues.push({level:'bad',title:'필수 필드 누락',detail:(p.id||'#'+idx)+' · '+missing.join(', ')});
    }

    const sc=Number(p.sectionCount);
    if(!Number.isFinite(sc)||sc<10||sc>20){
      sectionAnomaly++;
      reasons.push('섹션 수 '+String(p.sectionCount));
      if(issues.length<6)issues.push({level:'warn',title:'섹션 수 이상',detail:(p.id||'#'+idx)+' · '+String(p.sectionCount)});
    }

    if(!expectedCats.has(p.category)){
      categoryAnomaly++;
      reasons.push('비표준 카테고리');
      if(issues.length<6)issues.push({level:'warn',title:'비표준 카테고리',detail:(p.id||'#'+idx)+' · '+String(p.category)});
    }
    if(reasons.length&&anomalies.length<40){
      anomalies.push({
        id:p.id||'#'+idx,
        title:p.shortTitle||p.title||p.originalTitle||p.id||('#'+idx),
        category:p.category||'미분류',
        reasons
      });
    }
  });

  return {missingDoi,duplicateDoi,missingFields,sectionAnomaly,categoryAnomaly,issues,anomalies};
}

function detailSections(raw){
  if(Array.isArray(raw))return raw;
  if(!raw||typeof raw!=='object')return [];
  if(Array.isArray(raw.sections)){
    if(raw.sections.length===1&&raw.sections[0]&&Array.isArray(raw.sections[0].sections))return raw.sections[0].sections;
    return raw.sections;
  }
  return [];
}

async function auditDetailSample(papers,limit=12){
  const sample=papers.slice(0,limit);
  const results=await Promise.allSettled(sample.map(async p=>{
    const raw=await getJson(PAPER_DATA_BASE+p.file);
    const sections=detailSections(raw).filter(s=>s&&typeof s==='object');
    if(!sections.length)throw new Error('sections empty');
    return {id:p.id,count:sections.length};
  }));
  return {
    total:sample.length,
    ok:results.filter(r=>r.status==='fulfilled').length,
    failed:results.filter(r=>r.status==='rejected').length
  };
}

async function renderQuality(papers,q){
  q=q||auditIndex(papers);
  $('missingDoi').textContent=fmt(q.missingDoi);
  $('duplicateDoi').textContent=fmt(q.duplicateDoi);
  $('missingFields').textContent=fmt(q.missingFields);
  $('sectionAnomaly').textContent=fmt(q.sectionAnomaly);
  $('categoryAnomaly').textContent=fmt(q.categoryAnomaly);

  let sample={total:0,ok:0,failed:0};
  try{ sample=await auditDetailSample(papers,12); }catch(_){}
  $('detailSample').textContent=sample.ok+' / '+sample.total;

  const penalty=
    Math.min(25,q.missingDoi*2)+
    Math.min(30,q.duplicateDoi*5)+
    Math.min(25,q.missingFields*4)+
    Math.min(10,q.sectionAnomaly)+
    Math.min(5,q.categoryAnomaly)+
    Math.min(20,sample.failed*4);
  const score=Math.max(0,100-penalty);

  $('qualityScore').textContent=score;
  $('qualityBadge').textContent=score>=95?'CLEAN':score>=80?'REVIEW':'ATTENTION';
  $('qualityBadge').className='state '+(score>=95?'good':score>=80?'warn':'bad');
  $('qualityHeadline').textContent=score>=95?'데이터 구조 정상':score>=80?'일부 항목 점검 필요':'데이터 이상 확인 필요';
  $('qualityCopy').textContent='INDEX '+fmt(papers.length)+'편 전체 검사 · 상세 JSON '+sample.total+'편 샘플 검사';

  const events=q.issues.slice();
  if(q.missingDoi)events.unshift({level:'warn',title:'DOI 누락',detail:q.missingDoi+'건'});
  if(q.duplicateDoi)events.unshift({level:'bad',title:'DOI 중복',detail:q.duplicateDoi+'건'});
  if(sample.failed)events.unshift({level:'bad',title:'상세 JSON 읽기 실패',detail:sample.failed+' / '+sample.total});
  if(!events.length)events.push({level:'ok',title:'무결성 검사 통과',detail:'현재 감지된 주요 구조 이상 없음'});

  $('qualityEvents').innerHTML=events.slice(0,7).map(e=>
    '<div class="quality-event '+(e.level==='ok'?'':e.level)+'"><span></span><b>'+e.title+'</b><small>'+e.detail+'</small></div>'
  ).join('');
}

function parseBatch(commit){
  const msg=(commit.commit&&commit.commit.message||'').split('\n')[0];
  const m=msg.match(/^Add\s+(\d+)\s+academic paper analyses/i);
  if(!m)return null;
  return {count:Number(m[1]),date:new Date(commit.commit.author.date),sha:String(commit.sha).slice(0,7),msg};
}
function median(values){
  if(!values.length)return null;
  const a=values.slice().sort((x,y)=>x-y),mid=Math.floor(a.length/2);
  return a.length%2?a[mid]:(a[mid-1]+a[mid])/2;
}
function humanGap(ms){
  if(ms==null||!Number.isFinite(ms))return '—';
  const min=Math.round(ms/60000);
  if(min<60)return min+'m';
  const hr=min/60;
  return (hr>=10?Math.round(hr):hr.toFixed(1))+'h';
}
function renderAutomation(commits,runs){
  const now=Date.now();
  const batches=(commits||[]).map(parseBatch).filter(Boolean).sort((a,b)=>b.date-a.date);
  const recent=batches.filter(b=>now-b.date.getTime()<=DAY);
  const output=recent.reduce((s,b)=>s+b.count,0);
  const gaps=[];
  for(let i=0;i<recent.length-1;i++)gaps.push(recent[i].date-recent[i+1].date);
  const med=median(gaps);
  const abnormal=gaps.filter(g=>g>2.25*60*60*1000).length;
  const failed=(runs.workflow_runs||[]).filter(r=>r.status==='completed'&&['failure','timed_out','action_required','stale'].includes(String(r.conclusion||''))).length;
  const last=batches[0]||null;
  const age=last?now-last.date.getTime():Infinity;

  $('lastBatch').textContent=last?last.count+' PAPERS':'—';
  $('lastBatchAgo').textContent=last?timeFmt(last.date)+' · '+humanGap(age)+' ago':'no signal';
  $('output24h').textContent=fmt(output);
  $('batches24h').textContent=fmt(recent.length);
  $('avgBatch').textContent=recent.length?(output/recent.length).toFixed(1):'—';
  $('cadence').textContent=humanGap(med);
  $('gapCount').textContent=abnormal;
  $('failedDeploys').textContent=failed;
  $('lastSignal').textContent=last?humanGap(age):'—';

  $('batchTimeline').innerHTML=recent.slice(0,14).map(b=>`<div class="batch-row"><span>${timeFmt(b.date)}</span><b>${b.msg}</b><i>+${b.count}</i><small>${b.sha}</small></div>`).join('')||'<div class="batch-row"><b>최근 24시간 생성 커밋 없음</b></div>';

  const healthy=last&&age<2.25*60*60*1000&&failed===0;
  const watch=last&&age<4*60*60*1000;
  $('automationBadge').textContent=healthy?'ACTIVE':watch?'WATCH':'ATTENTION';
  $('automationBadge').className='state '+(healthy?'good':watch?'warn':'bad');
  $('incidentLevel').textContent=healthy?'CLEAR':watch?'WATCH':'ATTENTION';
  $('incidentCopy').textContent=healthy?'최근 생성 주기와 배포 흐름이 정상 범위입니다.':watch?'최근 생성 신호가 평소보다 지연되고 있습니다.':'최근 생성 신호가 오래되었거나 배포 실패가 감지되었습니다.';
  $('incidentLight').className='incident-light '+(healthy?'good':watch?'warn':'bad');
}

function analyze(papers){
  const cats={},dois=new Map(); let verified=0,sections=0,duplicateDois=0,minYear=9999,maxYear=0;
  papers.forEach(p=>{
    cats[p.category||'미분류']=(cats[p.category||'미분류']||0)+1;
    if(p.verified) verified++;
    sections+=Number(p.sectionCount||0);
    const y=Number(p.year); if(Number.isFinite(y)){minYear=Math.min(minYear,y);maxYear=Math.max(maxYear,y);}
    if(p.doi){const d=String(p.doi).toLowerCase(); if(dois.has(d)) duplicateDois++; else dois.set(d,true);}
  });
  return {cats,verified,sections,duplicateDois,minYear,maxYear};
}

function renderFields(cats){
  const entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const max=Math.max(...entries.map(x=>x[1]),1);
  $('fieldBars').innerHTML=entries.map(([name,count])=>`<div class="bar-row"><span>${name}</span><div class="bar"><i style="width:${count/max*100}%"></i></div><b>${fmt(count)}</b></div>`).join('');
  $('fieldSummary').textContent=entries.length+' DOMAINS';
}

function renderLatest(papers){
  $('latestPapers').innerHTML=papers.slice(0,6).map(p=>`<div class="paper-row"><span>${p.category||'미분류'}</span><b>${p.shortTitle||p.title||p.originalTitle||p.id}</b><i>${p.year||'—'}</i></div>`).join('');
}

async function load(){
  $('refresh').disabled=true; $('overall').textContent='SYNCING';
  let indexOK=false, deployOK=false, papers=[], indexAudit=null;
  try{
    papers=await getJson(PAPER_INDEX);
    indexOK=Array.isArray(papers);
    const a=analyze(papers);
    $('paperCount').textContent=fmt(papers.length); $('stripCount').textContent=fmt(papers.length)+' PAPERS';
    $('fieldCount').textContent=fmt(Object.keys(a.cats).length); $('sectionCount').textContent=fmt(a.sections);
    $('verifiedCount').textContent=fmt(a.verified); $('verifiedBadge').textContent=(a.verified===papers.length?'100% VERIFIED':fmt(a.verified)+' VERIFIED');
    $('yearRange').textContent=a.minYear+'–'+a.maxYear; $('avgSections').textContent=(a.sections/Math.max(papers.length,1)).toFixed(1);
    $('indexSize').textContent=(new Blob([JSON.stringify(papers)]).size/1024/1024).toFixed(2)+' MB';
    renderFields(a.cats); renderLatest(papers); renderLatestQuality(papers); renderFieldFlow(papers); indexAudit=auditIndex(papers); renderQuality(papers,indexAudit);
    setSignal('sigIndex','sigIndexText',true,fmt(papers.length)+'개 메타데이터 로드 정상');
    setSignal('sigVerify','sigVerifyText',a.verified===papers.length,fmt(a.verified)+' / '+fmt(papers.length)+' verified');
    setSignal('sigDoi','sigDoiText',a.duplicateDois===0,a.duplicateDois===0?'중복 DOI 없음':a.duplicateDois+'건 중복 감지');
  }catch(e){
    setSignal('sigIndex','sigIndexText',false,'INDEX 로드 실패 · '+e.message);
  }

  try{
    const [runs,commits,history]=await Promise.all([getJson(API+'/actions/runs?per_page=20'),getJson(API+'/commits?per_page=50'),getCommitHistory(30)]);
    const run=runs.workflow_runs&&runs.workflow_runs[0];
    deployOK=!!run&&run.status==='completed'&&run.conclusion==='success';
    $('deployBadge').textContent=deployOK?'DEPLOYED':'ATTENTION'; $('deployBadge').className='state '+(deployOK?'good':'warn');
    $('deployTitle').textContent=run?run.display_title:'—'; $('deployTime').textContent=run?timeFmt(run.updated_at):'—';
    $('deployStatus').textContent=run?(run.conclusion||run.status).toUpperCase():'—'; $('deployRun').textContent=run?'#'+run.run_number:'—'; $('deploySha').textContent=run?String(run.head_sha).slice(0,7):'—';
    $('commitList').innerHTML=(commits||[]).slice(0,5).map(c=>`<div class="commit"><span>${c.commit.message.split('\n')[0]}</span><small>${String(c.sha).slice(0,7)} · ${timeFmt(c.commit.author.date)}</small></div>`).join('');
    setSignal('sigDeploy','sigDeployText',deployOK,deployOK?'GitHub Pages 최신 배포 성공':'최근 배포 확인 필요');
    renderAutomation(commits,runs);
    renderIncidentCenter(papers,commits,runs,indexAudit);
    trendHistory=history;
    renderTrend(activeTrendRange);
  }catch(e){
    $('deployBadge').textContent='UNAVAILABLE'; $('deployBadge').className='state warn'; setSignal('sigDeploy','sigDeployText',false,'GitHub API 조회 실패');
  }

  const score=(indexOK?60:0)+(deployOK?25:0)+(papers.length?15:0);
  $('healthScore').textContent=score; $('healthLine').style.width=score+'%';
  $('healthBadge').textContent=score>=90?'OPERATIONAL':score>=60?'DEGRADED':'ATTENTION';
  $('healthBadge').className='state '+(score>=90?'good':score>=60?'warn':'bad');
  $('overall').textContent=score>=90?'OPERATIONAL':score>=60?'DEGRADED':'ATTENTION'; $('overall').className=$('healthBadge').className;
  $('healthCopy').textContent=indexOK?(deployOK?'논문 인덱스와 GitHub Pages 배포가 정상입니다.':'논문 데이터는 정상이나 배포 상태를 확인하세요.'):'논문 인덱스 연결을 확인하세요.';
  $('signalBadge').textContent=score>=90?'ALL CLEAR':'CHECK SIGNALS'; $('signalBadge').className='state '+(score>=90?'good':'warn');
  $('lastSync').textContent=timeFmt(new Date());
  $('refresh').disabled=false;
}

document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('nav a').forEach(x=>x.classList.remove('active'));a.classList.add('active')}));
$('refresh').addEventListener('click',load);
load();