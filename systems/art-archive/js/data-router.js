(()=>{
  'use strict';

  const nativeFetch=window.fetch.bind(window);
  const LEGACY_BASE='https://raw.githubusercontent.com/tom981105-web/art-archive/main/';
  const MIGRATING=new Set([
    'system-status.json',
    'system-events.json',
    'system-history.json',
    'system-usage.json'
  ]);

  function fileNameOf(input){
    const raw=typeof input==='string'?input:(input&&input.url)||'';
    try{
      const u=new URL(raw,location.href);
      return u.pathname.split('/').pop();
    }catch{
      return String(raw).split('?')[0].split('/').pop();
    }
  }

  function stampOf(data){
    if(!data||typeof data!=='object') return 0;
    const candidates=[
      data.updatedAt,
      data.generatedAt,
      data.timestamp,
      data.githubDeploy&&data.githubDeploy.updatedAt,
      data.appsScript&&data.appsScript.lastRun&&data.appsScript.lastRun.finishedAt
    ].filter(Boolean);
    let best=0;
    for(const value of candidates){
      const t=Date.parse(value);
      if(Number.isFinite(t)&&t>best) best=t;
    }
    return best;
  }

  async function readJson(url){
    try{
      const res=await nativeFetch(url,{cache:'no-store'});
      if(!res.ok) return null;
      const data=await res.json();
      return {data,stamp:stampOf(data),url};
    }catch{
      return null;
    }
  }

  window.fetch=async function(input,init){
    const file=fileNameOf(input);
    if(!MIGRATING.has(file)) return nativeFetch(input,init);

    const cacheBust='router='+Date.now();
    const localUrl=file+'?'+cacheBust;
    const legacyUrl=LEGACY_BASE+file+'?'+cacheBust;

    const [local,legacy]=await Promise.all([
      readJson(localUrl),
      readJson(legacyUrl)
    ]);

    let selected=null;
    if(local&&legacy){
      selected=local.stamp>=legacy.stamp?local:legacy;
    }else{
      selected=local||legacy;
    }

    if(!selected){
      return new Response(JSON.stringify({}),{
        status:503,
        headers:{'Content-Type':'application/json','X-ART-DATA-SOURCE':'unavailable'}
      });
    }

    const source=selected.url===localUrl?'nexus':'legacy';
    return new Response(JSON.stringify(selected.data),{
      status:200,
      headers:{
        'Content-Type':'application/json',
        'Cache-Control':'no-store',
        'X-ART-DATA-SOURCE':source
      }
    });
  };
})();
