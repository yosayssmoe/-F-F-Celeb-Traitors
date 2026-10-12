const H=require('./html.cjs');
const {resolveChronology,position}=require('./chronology.cjs');
async function get(url,config){
 let response;
 for(let attempt=0;attempt<3;attempt++){
  try{response=await fetch(url,{headers:{'User-Agent':config.userAgent,'Accept':'application/json,text/html;q=0.9'},signal:AbortSignal.timeout(config.requestTimeoutMs)});}
  catch(error){if(attempt===2)throw error;}
  if(response?.ok||response&&response.status!==429&&response.status<500)break;
  if(attempt<2)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
 }
 if(!response.ok)throw Error(`HTTP ${response.status} retrieving ${url}`);
 const body=await response.text();if(body.length>5_000_000)throw Error('Source response exceeds 5 MB limit.');return body;
}
async function wikipedia(config,log){
 const query=new URL('https://en.wikipedia.org/w/api.php');query.search=new URLSearchParams({action:'query',titles:config.wikipediaPage,prop:'revisions',rvprop:'ids|timestamp',format:'json',formatversion:2,maxlag:5});
 log.push({url:query.href,status:'requested'});const info=JSON.parse(await get(query.href,config));const revision=info.query?.pages?.[0]?.revisions?.[0];
 if(!revision?.revid||!revision.timestamp)throw Error('Wikipedia revision metadata unavailable: '+(info.error?.info||'unknown response'));
 const url=new URL('https://en.wikipedia.org/w/api.php');url.search=new URLSearchParams({action:'parse',oldid:revision.revid,prop:'text|revid',format:'json',maxlag:5});
 log.push({url:url.href,status:'requested'});const result=JSON.parse(await get(url.href,config));
 if(result.parse?.revid!==revision.revid||!result.parse?.text?.['*'])throw Error('Wikipedia revision changed or parse failed.');
 const retrievedAt=new Date().toISOString();log.forEach(s=>s.status='retrieved');
 return {html:result.parse.text['*'],revision:revision.revid,timestamp:revision.timestamp,retrievedAt};
}
async function corroborate(parsed,config,log){
 const priority=ep=>parsed.episodes.find(e=>e.episode===ep)?.issues.length?0:1;
 const refs=parsed.recaps.filter(r=>parsed.episodes.some(e=>e.episode===r.episode&&e.candidates.length)).sort((a,b)=>priority(a.episode)-priority(b.episode)||b.episode-a.episode).slice(0,config.maxRecapsPerRun);
 for(const ref of refs){
  const record={url:ref.url,episode:ref.episode,status:'requested'};log.push(record);
  try{
   const doc=H.parse(await get(ref.url,config));const article=H.all(doc,n=>n.tagName==='article')[0]||H.all(doc,n=>n.tagName==='main')[0];
   if(!article){record.status='no-structured-article';continue;}
   const sentences=H.all(article,n=>n.tagName==='p').map(H.text).flatMap(s=>s.split(/(?<=[.!?])\s+/));record.status='retrieved';
   for(const ep of parsed.episodes.filter(e=>e.episode===ref.episode)){
    const description=sentences.join(' '),positions=ep.candidates.map(c=>position(c,description));
    if(positions.length>1&&positions.every(p=>p!==null)&&new Set(positions).size===positions.length){
     const independent={...ep,description,issues:[...ep.issues],candidates:ep.candidates.map(c=>({...c}))};resolveChronology(independent);
     if(ep.safePrefix===ep.candidates.length&&independent.candidates.some((c,i)=>c.key!==ep.candidates[i].key))ep.issues.push({status:'conflicting',detail:'Independent recap chronology conflicts with structured source: '+ref.url});
     else if(ep.safePrefix<ep.candidates.length){ep.candidates=independent.candidates;ep.safePrefix=independent.safePrefix;ep.issues=independent.issues;for(const c of ep.candidates)c.evidence.push('Chronology independently established: '+ref.url);}
    }
   }
   for(const ep of parsed.episodes.filter(e=>e.episode===ref.episode))for(const c of ep.candidates){
    const who=c.event.victim||c.event.banished||c.event.who;if(!who)continue;
    const verb=c.event.type==='roundtable'?'banished':c.event.type==='recruit'?'recruited':'murdered';
    const safe=sentences.filter(s=>! /\b(not|never|could|would|might|may|if|predicted|previous|earlier)\b/i.test(s));
    const escaped=who.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    // Only an explicit full-name passive statement from the cited episode recap.
    if(safe.some(s=>new RegExp('^'+escaped+' (?:was|is|has been) (?:the first contestant to be )?'+verb+'\\b','i').test(s))){c.corroboration??=[];c.corroboration.push({title:'Independent episode recap',url:ref.url,retrievedAt:new Date().toISOString()});}
   }
  }catch(e){record.status='unavailable';record.reason=e.message;}
 }
}
module.exports={get,wikipedia,corroborate};
