const PAPER_INDEX='https://raw.githubusercontent.com/tom981105-web/paper/main/data/index.json';
const API='https://api.github.com/repos/tom981105-web/paper';
const $=id=>document.getElementById(id);
const fmt=n=>Number(n||0).toLocaleString('ko-KR');
const timeFmt=v=>v?new Intl.DateTimeFormat('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).format(new Date(v)):'—';

function clock(){ $('clock').textContent=new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).format(new Date()); }
setInterval(clock,1000);clock();

async function getJson(url){
  const r=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
  if(!r.ok) throw new Error(url+' HTTP '+r.status);
  return r.json();
}
function setSignal(id,textId,ok,text){ $(id).className='dot '+(ok?'ok':'fail'); $(textId).textContent=text; }

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
  let indexOK=false, deployOK=false, papers=[];
  try{
    papers=await getJson(PAPER_INDEX);
    indexOK=Array.isArray(papers);
    const a=analyze(papers);
    $('paperCount').textContent=fmt(papers.length); $('stripCount').textContent=fmt(papers.length)+' PAPERS';
    $('fieldCount').textContent=fmt(Object.keys(a.cats).length); $('sectionCount').textContent=fmt(a.sections);
    $('verifiedCount').textContent=fmt(a.verified); $('verifiedBadge').textContent=(a.verified===papers.length?'100% VERIFIED':fmt(a.verified)+' VERIFIED');
    $('yearRange').textContent=a.minYear+'–'+a.maxYear; $('avgSections').textContent=(a.sections/Math.max(papers.length,1)).toFixed(1);
    $('indexSize').textContent=(new Blob([JSON.stringify(papers)]).size/1024/1024).toFixed(2)+' MB';
    renderFields(a.cats); renderLatest(papers);
    setSignal('sigIndex','sigIndexText',true,fmt(papers.length)+'개 메타데이터 로드 정상');
    setSignal('sigVerify','sigVerifyText',a.verified===papers.length,fmt(a.verified)+' / '+fmt(papers.length)+' verified');
    setSignal('sigDoi','sigDoiText',a.duplicateDois===0,a.duplicateDois===0?'중복 DOI 없음':a.duplicateDois+'건 중복 감지');
  }catch(e){
    setSignal('sigIndex','sigIndexText',false,'INDEX 로드 실패 · '+e.message);
  }

  try{
    const [runs,commits]=await Promise.all([getJson(API+'/actions/runs?per_page=5'),getJson(API+'/commits?per_page=6')]);
    const run=runs.workflow_runs&&runs.workflow_runs[0];
    deployOK=!!run&&run.status==='completed'&&run.conclusion==='success';
    $('deployBadge').textContent=deployOK?'DEPLOYED':'ATTENTION'; $('deployBadge').className='state '+(deployOK?'good':'warn');
    $('deployTitle').textContent=run?run.display_title:'—'; $('deployTime').textContent=run?timeFmt(run.updated_at):'—';
    $('deployStatus').textContent=run?(run.conclusion||run.status).toUpperCase():'—'; $('deployRun').textContent=run?'#'+run.run_number:'—'; $('deploySha').textContent=run?String(run.head_sha).slice(0,7):'—';
    $('commitList').innerHTML=(commits||[]).slice(0,5).map(c=>`<div class="commit"><span>${c.commit.message.split('\n')[0]}</span><small>${String(c.sha).slice(0,7)} · ${timeFmt(c.commit.author.date)}</small></div>`).join('');
    setSignal('sigDeploy','sigDeployText',deployOK,deployOK?'GitHub Pages 최신 배포 성공':'최근 배포 확인 필요');
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