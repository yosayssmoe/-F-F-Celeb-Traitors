const H=require('./html.cjs');
const {resolveChronology}=require('./chronology.cjs');
const {revisionAge}=require('./revision-age.cjs');
async function get(url,config,allowedHosts){
 let response;
 for(let attempt=0;attempt<3;attempt++){
  try{response=await fetch(url,{headers:{'User-Agent':config.userAgent,'Accept':'application/json,text/html;q=0.9'},signal:AbortSignal.timeout(config.requestTimeoutMs)});}
  catch(error){if(attempt===2)throw error;}
  if(response?.ok||response&&response.status!==429&&response.status<500)break;
  if(attempt<2)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
 }
 if(!response.ok)throw Error(`HTTP ${response.status} retrieving ${url}`);
 if(allowedHosts&&response.url&&!allowedHosts.includes(new URL(response.url).hostname))throw Error('Source redirected outside permitted hosts.');
 const body=await response.text();if(body.length>5_000_000)throw Error('Source response exceeds 5 MB limit.');return body;
}
async function wikipedia(config,log){
 const query=new URL('https://en.wikipedia.org/w/api.php');query.search=new URLSearchParams({action:'query',titles:config.wikipediaPage,prop:'revisions',rvprop:'ids|timestamp',format:'json',formatversion:2,maxlag:5});
 log.push({url:query.href,status:'requested'});const info=JSON.parse(await get(query.href,config));const revision=info.query?.pages?.[0]?.revisions?.[0];
 if(!revision?.revid||!revision.timestamp)throw Error('Wikipedia revision metadata unavailable: '+(info.error?.info||'unknown response'));
 return pinnedRevision(revision,config,log);
}
async function pinnedRevision(revision,config,log){
 const url=new URL('https://en.wikipedia.org/w/api.php');url.search=new URLSearchParams({action:'parse',oldid:revision.revid,prop:'text|revid',format:'json',maxlag:5});
 log.push({url:url.href,status:'requested'});const result=JSON.parse(await get(url.href,config));
 if(result.parse?.revid!==revision.revid||!result.parse?.text?.['*'])throw Error('Wikipedia revision changed or parse failed.');
 const retrievedAt=new Date().toISOString();log.forEach(s=>s.status='retrieved');
 return {html:result.parse.text['*'],revision:revision.revid,timestamp:revision.timestamp,retrievedAt};
}
async function matureWikipedia(config,log,now=Date.now()){
 const cutoff=new Date(now-config.minimumRevisionAgeMinutes*60000).toISOString();
 const query=new URL('https://en.wikipedia.org/w/api.php');
 query.search=new URLSearchParams({action:'query',titles:config.wikipediaPage,prop:'revisions',rvprop:'ids|timestamp',rvstart:cutoff,rvdir:'older',rvlimit:1,format:'json',formatversion:2,maxlag:5});
 const record={url:query.href,status:'requested'};log.push(record);
 const info=JSON.parse(await get(query.href,config));record.status='retrieved';
 if(info.error)throw Error('Mature revision metadata unavailable: '+info.error.info);
 const revision=info.query?.pages?.[0]?.revisions?.[0];
 if(!revision)return null;
 if(!revision.revid||revisionAge(revision.timestamp,config.minimumRevisionAgeMinutes,now).deferred)throw Error('Historical query returned an ineligible revision.');
 return pinnedRevision(revision,config,log);
}
async function corroborate(parsed,config,log){
 const priority=ep=>parsed.episodes.find(e=>e.episode===ep)?.issues.length?0:1;
 const refs=parsed.recaps.filter(r=>{try{return new URL(r.url).protocol==='https:'&&['www.bbc.co.uk','www.bbc.com'].includes(new URL(r.url).hostname)&&config.recapHosts.includes(new URL(r.url).hostname)&&parsed.episodes.some(e=>e.episode===r.episode&&e.candidates.length);}catch{return false;}}).sort((a,b)=>priority(a.episode)-priority(b.episode)||b.episode-a.episode).slice(0,config.maxRecapsPerRun);
 for(const ref of refs){
  const record={url:ref.url,episode:ref.episode,status:'requested'};log.push(record);
  try{
   const doc=H.parse(await get(ref.url,config,['www.bbc.co.uk','www.bbc.com']));const article=H.all(doc,n=>n.tagName==='article')[0]||H.all(doc,n=>n.tagName==='main')[0];
   if(!article){record.status='no-structured-article';continue;}
   const sentences=H.all(article,n=>n.tagName==='p').map(H.text).flatMap(s=>s.split(/(?<=[.!?])\s+/));record.status='retrieved';
   for(const ep of parsed.episodes.filter(e=>e.episode===ref.episode)){
    const independent={...ep,description:sentences.join(' '),externalEdges:[],source:{title:'BBC episode recap',url:ref.url},issues:[],candidates:ep.candidates.map(c=>({...c}))};
    resolveChronology(independent);
    ep.externalEdges=[...(ep.externalEdges||[]),...independent.timeline.edges.filter(e=>['explicit-temporal-clause','recap-explicit-subsequent-night'].includes(e.reason))];
    resolveChronology(ep,ep.publishedEvents||[]);
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
module.exports={get,wikipedia,matureWikipedia,corroborate};
