const {parseWikipedia}=require('./wikipedia.cjs');
const {revisionAge}=require('./revision-age.cjs');
const {hash,stable}=require('./shared.cjs');

// Compare all inputs that this parser can send to chronology/validation/scoring.
// Ignore retrieval times, citations and prose wording, not facts or constraints.
function facts(parsed){
 return {cast:parsed.castAssertions||[],episodes:parsed.episodes.map(ep=>({episode:ep.episode,date:ep.date,noEvents:ep.noEvents,
  candidates:ep.candidates.map(c=>({key:c.key,event:c.event,verified:c.verified,observedRole:c.observedRole,rounds:c.rounds})).sort((a,b)=>a.key.localeCompare(b.key)),
  issues:ep.issues.map(i=>({scope:i.scope,eventKey:i.eventKey,status:i.status,detail:i.detail})).sort((a,b)=>stable(a).localeCompare(stable(b))),
  edges:[...new Set((ep.timeline?.edges||[]).map(e=>stable([e.before,e.after])))].sort()
 })).sort((a,b)=>a.episode-b.episode)};
}
async function selectRevision(latest,data,config,{now=Date.now(),getMature}={}){
 const latestAge=revisionAge(latest.timestamp,config.minimumRevisionAgeMinutes,now);
 const selection={strategy:'latest-mature',latestRevision:latest.revision,latestTimestamp:latest.timestamp,latestAge,selectedRevision:null};
 if(!latestAge.deferred){
  selection.selectedRevision=latest.revision;
  return {snapshot:latest,parsed:parseWikipedia(latest,data,config),timing:latestAge,selection};
 }
 const deferred=reason=>({snapshot:latest,parsed:null,timing:latestAge,selection:{...selection,strategy:'deferred',reason}});
 if(!getMature)return deferred('No mature revision supplied; latest scoring facts must age before use.');
 let mature;
 try{mature=await getMature();}catch(e){return deferred('Mature revision retrieval failed: '+e.message);}
 if(!mature)return deferred('No revision at or before the minimum-age cutoff was available.');
 const matureAge=revisionAge(mature.timestamp,config.minimumRevisionAgeMinutes,now);
 if(matureAge.deferred)throw Error('Selected historical revision has not reached the minimum age.');
 selection.matureRevision=mature.revision;selection.matureTimestamp=mature.timestamp;
 const oldParsed=parseWikipedia(mature,data,config),newParsed=parseWikipedia(latest,data,config);
 const oldFacts=facts(oldParsed),newFacts=facts(newParsed);
 selection.matureFactsHash=hash(oldFacts);selection.latestFactsHash=hash(newFacts);
 if(selection.matureFactsHash!==selection.latestFactsHash){
  selection.castChanged=stable(oldFacts.cast)!==stable(newFacts.cast);
  selection.differingEpisodes=[...new Set([...oldFacts.episodes,...newFacts.episodes].map(e=>e.episode))].filter(ep=>stable(oldFacts.episodes.find(e=>e.episode===ep))!==stable(newFacts.episodes.find(e=>e.episode===ep)));
  return deferred('Scoring facts or chronology differ from the mature revision. Recent results/corrections remain unscored until verified in a mature revision.');
 }
 // Do not resurrect an aged result which the latest revision has corrected.
 // Both parsed fact sets must agree; the normal merge checks still run next.
 selection.strategy='mature-with-latest-agreement';selection.selectedRevision=mature.revision;
 selection.reason='A pinned mature revision and the latest revision have identical extracted scoring facts and chronology constraints.';
 oldParsed.recaps=[...new Map([...oldParsed.recaps,...newParsed.recaps].map(r=>[r.url,r])).values()];
 return {snapshot:mature,parsed:oldParsed,timing:matureAge,selection};
}
module.exports={selectRevision,facts};
