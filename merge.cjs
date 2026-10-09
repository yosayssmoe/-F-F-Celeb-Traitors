const {T,D,E,clone,stable,hash,payload}=require('./shared.cjs');
const {verifyVotes}=require('./wikipedia.cjs');
const key=e=>e.type+':'+(e.who||e.victim||e.shielded||e.banished||(e.winners||[]).join('|')||'');
function assertDraw(d){
 const draw={Talia:['Ross Kemp','Jerry Hall','Richard E. Grant'],Joe:['Maya Jama',"Myha'la",'King Kenny'],Alex:['Romesh Ranganathan','James Blunt','Hannah Fry'],Apala:['Michael Sheen','Sharon Rooney','Leigh-Anne Pinnock'],Reuben:['Joe Lycett','Rob Beckett','Bella Ramsey'],Julian:['Julie Hesmondhalgh','James Acaster','Sebastian Croft'],Ava:['Joanne McNally','Miranda Hart']};
 if(stable([...d.participants].sort())!==stable(Object.keys(draw).sort()))throw Error('The seven participant names changed; automation will not alter the draw.');
 for(const c of d.celebs){const owner=Object.keys(draw).find(p=>draw[p].includes(c.name))||'';if(c.participant!==owner||(c.multiplier||1)!==(c.name==='Miranda Hart'?2:1))throw Error('Allocation/multiplier invariant failed for '+c.name);}
}
function locked(e){return e.automation?.locked===true || (e.automation?.payloadHash && e.automation.payloadHash!==hash(payload(e)));}
function mergeRound(old,fresh){
 // Existing assertions cannot be deleted or changed by an automated backfill.
 if(old.banished!==fresh.banished||stable([...(old.absent||[])].sort())!==stable([...(fresh.absent||[])].sort()))throw Error('Banishment or attendance conflicts with recorded results.');
 const a=[old.votes||{},...(old.revotes||[])],b=[fresh.votes||{},...(fresh.revotes||[])];
 for(let i=0;i<a.length;i++)for(const [v,t] of Object.entries(a[i]))if(t && b[i]?.[v]!==t)throw Error('A published vote is missing or changed for '+v+'.');
 if(old.votingComplete===true && !fresh.votingComplete)throw Error('Source regressed from a complete voting record.');
 return {...clone(old),votes:fresh.votes,revotes:fresh.revotes,absent:fresh.absent,votingComplete:fresh.votingComplete};
}
function merge(data,parsed,config,now=new Date().toISOString()){
 D.validate(data);assertDraw(data);let next=clone(data),changed=false,blockedAt=null;
 const report={checkedAt:now,sources:[parsed.source],accepted:[],deferred:[],unchanged:[],scoresChanged:false,dataUpdated:false,publication:'not attempted',beforeTotals:clone(E.totals(data)),afterTotals:null};
 const ordered=parsed.episodes.slice().sort((a,b)=>a.episode-b.episode);
 for(const ep of ordered){
  const old=next.events.filter(e=>e.ep===ep.episode),before=clone(next),accepted=[];
  const defer=(reason,status='deferred')=>report.deferred.push({episode:ep.episode,status,reason});
  const record=next.episodeRecords?.[ep.episode];
  if(old.some(locked)||record?.automationLocked||(record?.automationPayloadHash&&record.automationPayloadHash!==hash(old.map(payload)))){defer('Manually protected episode retained. Later results will use this authoritative local history.','manual-protected');continue;}
  if(blockedAt!==null&&ep.episode>=blockedAt){if(ep.candidates.length)defer('Earlier episode '+blockedAt+' needs resolution before new role/survival scoring.');continue;}
  if(ep.issues.some(x=>['conflicting','ambiguous','unsupported','incomplete'].includes(x.status))){ep.issues.forEach(x=>defer(x.detail,x.status));blockedAt=ep.episode;continue;}
  if(!ep.candidates.length){
   if(old.length){defer('The source no longer contains this episode’s existing events; keeping the published record.','conflicting');blockedAt=ep.episode;}
   else if(ep.noEvents)report.unchanged.push({episode:ep.episode,reason:'Source explicitly records no completed scoring events.'});
   else {report.deferred.push({episode:ep.episode,status:'not-published',reason:'No confirmed results published.'});blockedAt=ep.episode;}
   continue;
  }
  try{
   const candidates=ep.candidates;
   if(candidates.some(c=>!c.verified))throw Error('A result lacks the required supporting evidence.');
   if(config.requireIndependentCorroboration&&candidates.some(c=>!c.corroboration?.length))throw Error('Independent-source corroboration is required but unavailable.');
   if(old.some(e=>!candidates.some(c=>key(c.event)===key(e))))throw Error('Source conflicts with an existing event or omits it. Existing history retained.');
   // Never reorder existing events. The source must agree with their relative order.
   if(stable(candidates.filter(c=>old.some(e=>key(e)===key(c.event))).map(c=>key(c.event)))!==stable(old.map(key)))throw Error('Source event order conflicts with the existing chronology.');
   const merged=[];
   for(let i=0;i<candidates.length;i++){
    const c=candidates[i],existing=old.find(e=>key(e)===key(c.event));
    const prefix={...next,events:[...next.events.filter(e=>e.ep<ep.episode),...merged]};
    const s=T.compute(prefix),step=s.steps[prefix.events.length];
    let event=verifyVotes(c,step);
    if(existing){
     if(existing.type==='roundtable')event=mergeRound(existing,event);
     else {if(stable(payload(existing))!==stable(payload(event)))throw Error('Recorded event differs from source: '+key(event));event=clone(existing);}
    }
    if(existing&&stable(payload(existing))===stable(payload(event))){merged.push(clone(existing));continue;}
    const sourceList=[ep.source,...(c.corroboration||[])];
    event.id=existing?.id||`ep${ep.episode}-auto-${hash(key(event)).slice(0,12)}`;
    event.automation={owner:'github-actions',verification:c.corroboration?.length?'corroborated':'structured-verified',verifiedAt:now,payloadHash:hash(payload(event)),sources:sourceList,evidence:c.evidence,locked:false};
    merged.push(event);accepted.push({episode:ep.episode,event:key(event),action:existing?'backfilled':'added',votingComplete:event.type==='roundtable'?event.votingComplete:undefined,verification:event.automation.verification,sources:sourceList});
   }
   if(!accepted.length){report.unchanged.push({episode:ep.episode,reason:'All observed events already recorded.'});continue;}
   next.events=[...next.events.filter(e=>e.ep<ep.episode),...merged,...next.events.filter(e=>e.ep>ep.episode)];
   D.validate(next);assertDraw(next);
   const computed=T.compute(next);if(Object.values(computed.contestants).some(s=>!Number.isFinite(s.celebScore)||!Number.isFinite(s.contributed)))throw Error('Non-finite score detected.');
   next.episodeRecords??={};const previous=next.episodeRecords[ep.episode]||null;
   // Complete voting is not a claim that every future episode outcome is known.
   const complete=merged.filter(e=>e.type==='roundtable').every(e=>e.votingComplete===true);
   next.episodeRecords[ep.episode]={...(previous||{}),date:ep.date||previous?.date||'',status:complete?'complete':'partial',notes:'Automatically verified structured events. Unsupported or unpublished information remains in the workflow report.',sources:[ep.source],approvedAt:now,automationPayloadHash:hash(merged.map(payload)),automationLocked:false};
   next.episodeAudit??=[];next.episodeAudit.push({episode:ep.episode,approvedAt:now,method:'GitHub Actions verified update',previousEvents:old,previousRecord:previous,newEvents:clone(merged),sources:[ep.source]});
   report.accepted.push(...accepted);changed=true;
  }catch(e){next=before;defer(e.message,'conflicting');blockedAt=ep.episode;}
 }
 report.afterTotals=clone(E.totals(next));report.scoresChanged=stable(report.beforeTotals)!==stable(report.afterTotals);report.dataUpdated=changed;
 if(changed){
  const latest=Math.max(...next.events.map(e=>e.ep));const tables=next.events.filter(e=>e.type==='roundtable');
  const voting=tables.length?(tables.every(e=>e.votingComplete===true)?'Complete':'Partial'):'Pending';
  next.automation={...(next.automation||{}),version:1,lastVerifiedUpdate:now,latestConfirmedEpisode:latest,votingData:voting,scheduleDescription:config.scheduleDescription,verification:'structured-source validation',pendingEpisodes:[...new Set(report.deferred.map(x=>x.episode))],runUrl:process.env.GITHUB_RUN_ID?`https://github.com/${config.repository}/actions/runs/${process.env.GITHUB_RUN_ID}`:null};
 }
 D.validate(next);return {data:next,changed,report};
}
module.exports={merge,assertDraw,mergeRound,locked};
