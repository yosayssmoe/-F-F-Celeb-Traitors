/* Episode snapshots are staged, validated, previewed, then explicitly approved.
   This module uses the existing scoring engine; it never stores hand-entered scores. */
window.EpisodeUpdates = (() => {
  const SERIES='celebrity-traitors-uk-2';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const stable=x=>JSON.stringify(sort(x));
  function sort(x) { if(Array.isArray(x)) return x.map(sort); if(x && typeof x==='object') return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])); return x; }
  function signature(e) {
    const keys={murder:['victim','shielded'],recruit:['who','accepted'],exit:['who'],final:['winners'],roundtable:['votes','revotes','absent','banished','votingComplete']};
    return stable(Object.fromEntries(['type',...(keys[e.type]||[])].map(k=>[k,e[k]??null])));
  }
  function migrate(data) {
    const d=copy(data);
    d.episodeRecords=d.episodeRecords||{};
    if(!d.episodeRecords[1]) d.episodeRecords[1]={date:'2026-10-01',status:'seeded',notes:'Starting roles are in Draw & starting roles. No completed scoring event in Episode 1.',sources:[]};
    if(!d.episodeRecords[2] && d.events.some(e=>e.ep===2)) d.episodeRecords[2]={date:'2026-10-02',status:'seeded',notes:'Existing events retained. The packaged baseline records Amol’s murder, then James Acaster’s recruitment. No completed Round Table vote.',sources:[]};
    return d;
  }
  function snapshot(data,episode) {
    const meta=data.episodeRecords?.[episode]||{};
    return {schemaVersion:1,series:SERIES,episode,date:meta.date||'',status:meta.status==='complete'?'complete':'partial',notes:meta.notes||'',sources:copy(meta.sources||[]),events:copy(data.events.filter(e=>e.ep===episode))};
  }
  function normalize(raw) {
    if(!raw || raw.schemaVersion!==1 || raw.series!==SERIES) throw Error('Use episode schemaVersion 1 and series "'+SERIES+'".');
    if(!Number.isInteger(raw.episode) || raw.episode<1 || raw.episode>100) throw Error('Episode must be a whole number from 1 to 100.');
    if(!Array.isArray(raw.events) || raw.events.length>100) throw Error('Episode events must be a list of at most 100 events.');
    if(raw.date && (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date) || !Number.isFinite(Date.parse(raw.date)) || new Date(raw.date).toISOString().slice(0,10)!==raw.date)) throw Error('Date must be a valid YYYY-MM-DD date, or blank.');
    if(!['partial','complete'].includes(raw.status)) throw Error('Episode status must be partial or complete.');
    if(raw.notes!==undefined && (typeof raw.notes!=='string'||raw.notes.length>10000)) throw Error('Notes must be text, at most 10,000 characters.');
    if(!Array.isArray(raw.sources) || raw.sources.length>30) throw Error('Sources must be a list (use [] for manual results).');
    raw.sources.forEach(s=>{if(!s || typeof s.title!=='string' || !s.title.trim() || typeof s.url!=='string' || !/^https?:\/\//i.test(s.url)) throw Error('Each source needs a title and an http(s) URL.'); new URL(s.url);});
    const p=copy(raw),ids=new Set(),sigs=new Set();
    p.events.forEach((e,i)=>{
      if(!e || typeof e!=='object' || !['murder','roundtable','recruit','exit','final'].includes(e.type)) throw Error('Unknown event type at position '+(i+1)+'.');
      if(e.ep!==undefined && e.ep!==p.episode) throw Error('An event episode does not match the selected episode.');
      e.ep=p.episode;
      if(e.type==='roundtable') {
        e.votes=e.votes||{};e.revotes=e.revotes||[];e.absent=e.absent||[];e.banished=e.banished||null;
        const voteMap=r=>r && typeof r==='object' && !Array.isArray(r) && Object.entries(r).every(([v,t])=>v.length>0&&typeof t==='string');
        if(!voteMap(e.votes)||!Array.isArray(e.revotes)||!e.revotes.every(voteMap)||!Array.isArray(e.absent)||!e.absent.every(n=>typeof n==='string'))throw Error('Round Table votes/revotes must be vote objects, with absent as a name list.');
        if(e.votingComplete!==undefined && typeof e.votingComplete!=='boolean')throw Error('votingComplete must be a boolean.');
        e.votingComplete=e.votingComplete===true;
      }
      if(e.type==='final' && (!Array.isArray(e.winners)||!e.winners.every(n=>typeof n==='string')))throw Error('Final winners must be a name list.');
      if(e.type==='recruit' && typeof e.accepted!=='boolean') throw Error('Recruitment needs accepted: true or false.');
      if(!e.id) e.id=`ep${p.episode}-${e.type}-${i+1}`;
      if(typeof e.id!=='string' || !new RegExp('^ep'+p.episode+'-[a-zA-Z0-9_-]+$').test(e.id)) throw Error('Event IDs must start with ep'+p.episode+'- and use letters, numbers, dashes or underscores.');
      const duplicateKey=signature(e.type==='roundtable'?{...e,votingComplete:false}:e);
      if(ids.has(e.id)||sigs.has(duplicateKey)) throw Error('Duplicate event in episode: '+e.id);
      ids.add(e.id);sigs.add(duplicateKey);
    });
    if(p.status==='complete' && p.events.some(e=>e.type==='roundtable'&&!e.votingComplete)) throw Error('An episode with incomplete voting must remain partial.');
    return p;
  }
  function totals(data) { const s=window.TraitorsScoring.compute(data);return Object.fromEntries(data.participants.map(p=>[p,data.celebs.filter(c=>c.participant===p).reduce((a,c)=>a+s.contestants[c.name].contributed,0)])); }
  function prepare(data,raw) {
    const p=normalize(raw),next=copy(data),before=data.events.filter(e=>e.ep===p.episode);
    next.events=[...copy(data.events.filter(e=>e.ep<p.episode)),...copy(p.events),...copy(data.events.filter(e=>e.ep>p.episode))];
    window.SweepstakeData.validate(next); // Replay every later event, too: historical corrections cannot silently invalidate it.
    const warnings=[];
    if(p.status==='partial') warnings.push('This episode is partial. Only known events and votes will score.');
    if(!p.sources.length) warnings.push('No source links supplied. Verify manual results before approval.');
    p.events.filter(e=>e.type==='roundtable'&&!e.votingComplete).forEach(e=>warnings.push(e.id+': voting is incomplete; zero-vote bonuses are withheld for everyone. Known correct Traitor votes and a confirmed banishment still score.'));
    const removed=before.filter(e=>!p.events.some(n=>signature(n)===signature(e)));
    if(removed.length) warnings.push(`${removed.length} existing event(s) will be replaced or removed. Review both versions below.`);
    const prior=data.episodeRecords?.[p.episode];
    if(prior?.status==='complete' && p.status!=='complete') warnings.push('This will change a previously complete episode to partial.');
    for(let ep=1;ep<p.episode;ep++) if(!data.episodeRecords?.[ep]&&!data.events.some(e=>e.ep===ep)) warnings.push('Episode '+ep+' has no record. Earlier missing events may change roles and scores.');
    const same=stable(before.map(signature))===stable(p.events.map(signature));
    const metadataSame=prior && stable({date:prior.date||'',status:prior.status,notes:prior.notes||'',sources:prior.sources||[]})===stable({date:p.date||'',status:p.status,notes:p.notes||'',sources:p.sources});
    next.episodeRecords=copy(data.episodeRecords||{});
    next.episodeRecords[p.episode]={date:p.date||'',status:p.status,notes:p.notes||'',sources:p.sources,approvedAt:new Date().toISOString()};
    const changed=!same||!metadataSame;
    if(changed) {next.episodeAudit=copy(data.episodeAudit||[]);next.episodeAudit.push({episode:p.episode,approvedAt:next.episodeRecords[p.episode].approvedAt,previousEvents:copy(before),previousRecord:copy(prior||null),newEvents:copy(p.events),sources:copy(p.sources)});}
    return {data:next,package:p,before,after:p.events,warnings,changed,beforeTotals:totals(data),afterTotals:totals(next),historical:data.events.some(e=>e.ep>p.episode)};
  }
  // Online proposals never erase existing manual evidence. Exact observations are
  // matched; differing versions stay in the draft as explicit conflicts to resolve.
  function combine(existing,incoming) {
    const out=copy(existing);out.sources=[...existing.sources,...incoming.sources].filter((s,i,a)=>a.findIndex(x=>x.url===s.url)===i);
    out.date=incoming.date||existing.date;out.status='partial';
    out.notes=[...new Set([existing.notes,incoming.notes].filter(Boolean).flatMap(n=>n.split('\n')))].join('\n');
    const warnings=[];
    incoming.events.forEach(e=>{
      const matches=out.events.filter(x=>x.type===e.type && (e.type==='roundtable' ? x.banished===e.banished : (x.who||x.victim||x.shielded||'')===(e.who||e.victim||e.shielded||'')));
      if(matches.some(x=>signature(x)===signature(e))) return;
      if(matches.length) { warnings.push('Conflicting '+e.type+' record: existing data retained. Compare the retrieved proposal before correcting it.'); return; }
      out.events.push(copy(e));
    });
    out.events.forEach((e,i)=>{e.id=`ep${out.episode}-${e.type}-${i+1}`;});
    return {package:out,warnings};
  }
  function recordManualEdit(before,after) {
    const next=copy(after);next.episodeRecords=next.episodeRecords||{};next.episodeAudit=next.episodeAudit||[];
    const episodes=new Set([...before.events,...after.events].map(e=>e.ep));
    episodes.forEach(ep=>{
      const old=before.events.filter(e=>e.ep===ep),now=after.events.filter(e=>e.ep===ep);
      if(stable(old)!==stable(now)) {
        const time=new Date().toISOString();
        next.episodeAudit.push({episode:ep,approvedAt:time,previousEvents:copy(old),previousRecord:copy(before.episodeRecords?.[ep]||null),newEvents:copy(now),sources:[],method:'Manage game log'});
        next.episodeRecords[ep]={date:next.episodeRecords[ep]?.date||'',sources:next.episodeRecords[ep]?.sources||[],notes:'Edited in Manage. Re-review episode coverage in Update Episode.',status:'partial',approvedAt:time};
      }
    });return next;
  }
  return {SERIES,migrate,snapshot,normalize,prepare,combine,signature,totals,recordManualEdit};
})();
