(()=>{
  'use strict';

  const SOURCES=[
    {key:'automation',label:'AUTOMATION',file:'automation-status.json'},
    {key:'runtime',label:'RUNTIME',file:'system-status.json'},
    {key:'usage',label:'USAGE',file:'system-usage.json'},
    {key:'events',label:'EVENTS',file:'system-events.json'},
    {key:'history',label:'HISTORY',file:'system-history.json'}
  ];
  const state={};

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
      const r=await fetch(src.file+'?nexus='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const data=await r.json();
      state[src.key]={timestamp:extractTimestamp(data),error:null};
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