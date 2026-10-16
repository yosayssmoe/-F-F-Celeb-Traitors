const {T,D,E,clone,stable,hash,payload}=require('./shared.cjs');
const {verifyVotes}=require('./wikipedia.cjs');
const {dependent}=require('./chronology.cjs');
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
 D.validate(data);assertDraw(data);let next=clone(data),changed=false;const blockers=[];
 const report={checkedAt:now,sources:[parsed.source],accepted:[],deferred:[],unchanged:[],scoresChanged:false,dataUpdated:false,publication:'not attempted',beforeTotals:clone(E.totals(data)),afterTotals:null};
 const ordered=parsed.episodes.slice().sort((a,b)=>a.episode-b.episode);
 // A disappearing pending candidate is a source regression, not a resolution.
 // Revisit it, and keep its state dependency until evidence returns.
 for(const item of data.automation?.pendingEvents||[]){
  if(!item.event||!item.candidate)continue;
  const ep=ordered.find(e=>e.episode===item.episode);
  if(ep?.candidates.some(c=>key(c.event)===item.event))continue;
  report.deferred.push({...clone(item),status:'source-missing',reason:'Previously pending event is absent from this source revision; awaiting renewed verification.'});
  blockers.push({id:`ep${item.episode}:${item.event}`,event:item.candidate.event||item.candidate,episode:item.episode});
 }
 report.timelines=ordered.filter(ep=>ep.timeline).map(ep=>({episode:ep.episode,...ep.timeline}));
 for(const ep of ordered){
  const old=next.events.filter(e=>e.ep===ep.episode),before=clone(next),accepted=[];
  const defer=(reason,status='deferred')=>report.deferred.push({episode:ep.episode,status,reason});
  const record=next.episodeRecords?.[ep.episode];
  if(old.some(locked)||record?.automationLocked||(record?.automationPayloadHash&&record.automationPayloadHash!==hash(old.map(payload)))){defer('Manually protected episode retained. Later results will use this authoritative local history.','manual-protected');continue;}
  const issues=ep.issues.filter(x=>['conflicting','ambiguous','unsupported','incomplete'].includes(x.status));
  issues.forEach(x=>defer(x.detail,x.status));
  // Unscoped issues can hide an earlier role change or elimination.
  const globalIssue=issues.some(x=>!x.eventKey&&x.scope!=='chronology');
  const limit=globalIssue?0:(ep.safePrefix??ep.candidates.length);
  const hold=(c,reason,status='event-pending',dependencies=[])=>{
   const id=`ep${ep.episode}:${key(c.event)}`;
   const source=clone(ep.source);delete source.retrievedAt;
   report.deferred.push({episode:ep.episode,event:key(c.event),status,reason,dependencies,candidate:clone(c),sources:[source],evidence:c.evidence||[]});
   if(!old.some(e=>key(e)===key(c.event)))blockers.push({id,event:c.event});
  };
  for(const c of ep.candidates.slice(limit)){
   const node=ep.timeline?.pending.find(n=>n.event===key(c.event));
   hold(c,node?.reason||'An unresolved event may change role or survival eligibility.','chronology-pending',(node?.dependencies||[]).map(k=>`ep${ep.episode}:${k}`));
   const blocker=blockers.find(b=>b.id===`ep${ep.episode}:${key(c.event)}`);if(blocker)blocker.afterSafePrefix=ep.episode;
  }
  if(globalIssue){blockers.push({id:`ep${ep.episode}:unknown-event`,event:null});continue;}
  if(!limit&&ep.candidates.length)continue;
  if(!ep.candidates.length){
   if(old.length){defer('The source no longer contains this episode’s existing events; keeping the published record.','conflicting');blockers.push({id:`ep${ep.episode}:missing-history`,event:null});}
   else if(ep.noEvents)report.unchanged.push({episode:ep.episode,reason:'Source explicitly records no completed scoring events.'});
   else {report.deferred.push({episode:ep.episode,status:'not-published',reason:'No confirmed results published.'});blockers.push({id:`ep${ep.episode}:not-published`,event:null});}
   continue;
  }
  try{
   const candidates=ep.candidates.slice(0,limit);
   if(new Set(ep.candidates.map(c=>key(c.event))).size!==ep.candidates.length)throw Error('Duplicate event candidates; episode retained for verification.');
   if(old.some(e=>!ep.candidates.some(c=>key(c.event)===key(e))))throw Error('Source conflicts with an existing event or omits it. Existing history retained.');
   // Never reorder existing events. The source must agree with their relative order.
   if(stable(candidates.filter(c=>old.some(e=>key(e)===key(c.event))).map(c=>key(c.event)))!==stable(old.filter(e=>candidates.some(c=>key(c.event)===key(e))).map(key)))throw Error('Source event order conflicts with the existing chronology.');
   const merged=[];
   for(let i=0;i<candidates.length;i++){
    try{
    const c=candidates[i],existing=old.find(e=>key(e)===key(c.event));
    const dependencies=blockers.filter(b=>(!b.episode||b.episode<=ep.episode)&&b.afterSafePrefix!==ep.episode&&b.id!==`ep${ep.episode}:${key(c.event)}`&&dependent(b.event,c.event));
    if(!existing&&dependencies.length){hold(c,'Earlier pending events can change the roles, attendance or survival points used by this event.','dependency-pending',dependencies.map(b=>b.id));continue;}
    if(!c.verified||issues.some(x=>x.eventKey===key(c.event)))throw Error('Event lacks consistent supporting evidence: '+key(c.event));
    if(config.requireIndependentCorroboration&&!c.corroboration?.length)throw Error('Independent-source corroboration is required but unavailable.');
    const prefix={...next,events:[...next.events.filter(e=>e.ep<ep.episode),...merged]};
    const s=T.compute(prefix),step=s.steps[prefix.events.length];
    if(c.observedRole&&step.roles[c.event.victim||c.event.banished]!==c.observedRole)throw Error('Source role conflicts with the validated event history: '+key(c.event));
    let event=verifyVotes(c,step);
    if(existing){
     if(existing.type==='roundtable')event=mergeRound(existing,event);
     else {if(stable(payload(existing))!==stable(payload(event)))throw Error('Recorded event differs from source: '+key(event));event=clone(existing);}
    }
    if(existing&&stable(payload(existing))===stable(payload(event))){merged.push(clone(existing));continue;}
    const sourceList=[ep.source,...(c.corroboration||[])];
    event.id=existing?.id||`ep${ep.episode}-auto-${hash(key(event)).slice(0,12)}`;
    event.automation={owner:'github-actions',verification:c.corroboration?.length?'corroborated':'structured-verified',verifiedAt:now,payloadHash:hash(payload(event)),sources:sourceList,evidence:c.evidence,chronology:ep.timeline?.edges.filter(e=>e.before===key(c.event)||e.after===key(c.event))||[],locked:false};
    D.validate({...next,events:[...next.events.filter(e=>e.ep<ep.episode),...merged,event,...old.filter(e=>!merged.some(m=>key(m)===key(e))&&key(e)!==key(event)),...next.events.filter(e=>e.ep>ep.episode)]});
    merged.push(event);accepted.push({episode:ep.episode,event:key(event),action:existing?'backfilled':'added',votingComplete:event.type==='roundtable'?event.votingComplete:undefined,verification:event.automation.verification,sources:sourceList});
    }catch(error){
     const c=candidates[i],existing=old.find(e=>key(e)===key(c.event));
     if(existing?.type==='roundtable'&&c.verified&&/^A published vote|^Source regressed/.test(error.message)){
      report.deferred.push({episode:ep.episode,event:key(existing),status:'conflicting',reason:error.message});
      merged.push(clone(existing));continue;
     }
     hold(c,error.message);
     if(existing)merged.push(clone(existing));
    }
   }
   merged.push(...old.filter(e=>!merged.some(m=>key(m)===key(e))));
   if(!accepted.length){report.unchanged.push({episode:ep.episode,reason:'No newly verified scoring changes.'});continue;}
   next.events=[...next.events.filter(e=>e.ep<ep.episode),...merged,...next.events.filter(e=>e.ep>ep.episode)];
   D.validate(next);assertDraw(next);
   const computed=T.compute(next);if(Object.values(computed.contestants).some(s=>!Number.isFinite(s.celebScore)||!Number.isFinite(s.contributed)))throw Error('Non-finite score detected.');
   next.episodeRecords??={};const previous=next.episodeRecords[ep.episode]||null;
   // Complete voting is not a claim that every future episode outcome is known.
   const complete=!report.deferred.some(x=>x.episode===ep.episode)&&merged.filter(e=>e.type==='roundtable').every(e=>e.votingComplete===true);
   next.episodeRecords[ep.episode]={...(previous||{}),date:ep.date||previous?.date||'',status:complete?'complete':'partial',notes:'Automatically verified structured events. Unsupported or unpublished information remains in the workflow report.',sources:[ep.source],approvedAt:now,automationPayloadHash:hash(merged.map(payload)),automationLocked:false};
   next.episodeAudit??=[];next.episodeAudit.push({episode:ep.episode,approvedAt:now,method:'GitHub Actions verified update',previousEvents:old,previousRecord:previous,newEvents:clone(merged),sources:[ep.source]});
   report.accepted.push(...accepted);changed=true;
  }catch(e){next=before;defer(e.message,'conflicting');blockers.push({id:`ep${ep.episode}:conflicting`,event:null});}
 }
 // Pending state is canonical and durable, but stable checks must not churn commits.
 const missingVotes=[];
 for(let i=0;i<next.events.length;i++){
  const event=next.events[i];if(event.type!=='roundtable'||event.votingComplete===true)continue;
  const state=T.compute({...next,events:next.events.slice(0,i)}).steps[i];
  const voters=state.active.filter(n=>!(event.absent||[]).includes(n));
  missingVotes.push({episode:event.ep,event:key(event),voters:voters.filter(n=>!event.votes?.[n]),reason:'Full voting rounds, attendance and tally must be verified before zero-vote bonuses.'});
 }
 const pending=[...report.deferred.map(x=>({...x,id:hash([x.episode,x.event||'',x.status,x.reason]).slice(0,16)})),...missingVotes.map(x=>({...x,id:hash([x.episode,x.event,'votes']).slice(0,16),status:'missing-votes'}))];
 // Preserve unresolved records for episodes omitted altogether by a regressing source.
 for(const item of data.automation?.pendingEvents||[])if(!ordered.some(e=>e.episode===item.episode)&&!pending.some(p=>p.episode===item.episode&&p.event===item.event))pending.push(item);
 const beforePending=data.automation?.pendingEvents||[];
 const pendingChanged=stable(beforePending)!==stable(pending);
 let recordsChanged=false;
 for(const ep of ordered){
  const record=next.episodeRecords?.[ep.episode];if(!record||record.automationLocked||!record.automationPayloadHash)continue;
  const events=next.events.filter(e=>e.ep===ep.episode);
  if(record.automationPayloadHash!==hash(events.map(payload)))continue;
  const complete=!pending.some(x=>x.episode===ep.episode)&&ep.candidates.length===events.length&&ep.candidates.every(c=>c.verified)&&events.filter(e=>e.type==='roundtable').every(e=>e.votingComplete===true);
  const status=complete?'complete':'partial';if(record.status!==status){record.status=status;recordsChanged=true;}
 }
 const latestChecked=Math.max(0,...ordered.filter(e=>e.description||e.candidates.length||(e.date&&e.date<=now.slice(0,10))).map(e=>e.episode));
 const partial=[...new Set([...missingVotes.map(x=>x.episode),...pending.filter(x=>next.events.some(e=>e.ep===x.episode)).map(x=>x.episode)])].sort((a,b)=>a-b);
 const completeEpisodes=Object.keys(next.episodeRecords||{}).map(Number).filter(ep=>next.episodeRecords[ep].status==='complete'&&!partial.includes(ep));
 const latestFullyScored=Math.max(0,...completeEpisodes);
 report.latestEpisodeChecked=latestChecked;report.latestEpisodeFullyScored=latestFullyScored;report.partiallyScoredEpisodes=partial;
 report.pendingEvents=pending;report.missingIndividualVotes=missingVotes;report.sourceConflicts=report.deferred.filter(x=>x.status==='conflicting'||/conflict|changed|differs/i.test(x.reason));
 report.afterTotals=clone(E.totals(next));report.scoresChanged=stable(report.beforeTotals)!==stable(report.afterTotals);
 report.pointsAdded=Object.fromEntries(Object.keys(report.afterTotals).map(p=>[p,report.afterTotals[p]-report.beforeTotals[p]]));
 const beforeCelebs=T.compute(data).contestants,afterCelebs=T.compute(next).contestants;
 report.celebrityPointsAdded=Object.fromEntries(Object.keys(afterCelebs).map(n=>[n,afterCelebs[n].celebScore-beforeCelebs[n].celebScore]));
 if(changed||pendingChanged||recordsChanged){
  const latest=Math.max(0,...next.events.map(e=>e.ep));const tables=next.events.filter(e=>e.type==='roundtable');
  const voting=tables.length?(tables.every(e=>e.votingComplete===true)?'Complete':'Partial'):'Pending';
  next.automation={...(next.automation||{}),version:2,...(changed?{lastVerifiedUpdate:now}:{}),latestConfirmedEpisode:latest,latestEpisodeChecked:latestChecked,latestEpisodeFullyScored:latestFullyScored,partiallyScoredEpisodes:partial,votingData:voting,scheduleDescription:config.scheduleDescription,verification:'structured-source validation',pendingEvents:pending,pendingEpisodes:[...new Set(pending.map(x=>x.episode))],runUrl:process.env.GITHUB_RUN_ID?'https://github.com/'+config.repository+'/actions/runs/'+process.env.GITHUB_RUN_ID:null};
  for(const ep of partial)if(next.episodeRecords?.[ep])next.episodeRecords[ep].status='partial';
 }
 changed=changed||pendingChanged||recordsChanged;report.dataUpdated=changed;
 D.validate(next);return {data:next,changed,report};
}
module.exports={merge,assertDraw,mergeRound,locked};
