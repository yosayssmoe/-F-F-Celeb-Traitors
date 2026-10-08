/* Strict validation at save/import boundaries. Never execute imported JavaScript. */
window.SweepstakeData = (() => {
  function validate(d) {
    const fail = message => { throw new Error(message); };
    const unique = xs => new Set(xs).size === xs.length;
    const strings = xs => Array.isArray(xs) && xs.every(x=>typeof x==='string' && x.trim()===x && x.length>0 && x.length<120);
    if (!d || typeof d!=='object' || !strings(d.participants) || !d.participants.length || !unique(d.participants)) fail('Participant names must be nonempty and unique.');
    if (!Array.isArray(d.celebs) || d.celebs.length!==21) fail('The dataset must contain exactly 21 competing contestants. Claudia is a special rule, not a contestant.');
    const names=d.celebs.map(c=>c.name);
    if (!strings(names) || !unique(names) || names.some(n=>/claudia/i.test(n))) fail('Contestant names must be unique; Claudia cannot be a contestant.');
    d.celebs.forEach(c=>{
      if (c.participant && !d.participants.includes(c.participant)) fail(c.name+': select a listed participant or Unassigned.');
      if (![1,2,3].includes(c.multiplier ?? 1)) fail(c.name+': multiplier must be 1, 2 or 3.');
      if (c.photo && /^(https?:|\/\/)/i.test(c.photo)) fail('Photos must be local files for offline use.');
    });
    if (!Array.isArray(d.episodes) || d.episodes.some(s=>typeof s!=='string' || !/(Z|[+-]\d\d:\d\d)$/.test(s) || !Number.isFinite(Date.parse(s))) || d.episodes.some((s,i)=>i && Date.parse(s)<=Date.parse(d.episodes[i-1]))) fail('Episode air times must be valid ISO dates with timezones, in chronological order.');
    if (!Array.isArray(d.originalTraitors) || !unique(d.originalTraitors) || d.originalTraitors.some(n=>!names.includes(n))) fail('Invalid original Traitors.');
    if (!Array.isArray(d.events)) fail('Events must be a list.');
    const ids = d.events.map(e=>e.id).filter(Boolean);
    if (!unique(ids)) fail('Event IDs must be unique. An event cannot be scored twice.');
    if(d.episodeRecords!==undefined) {
      if(!d.episodeRecords || typeof d.episodeRecords!=='object' || Array.isArray(d.episodeRecords)) fail('Invalid episode records.');
      Object.entries(d.episodeRecords).forEach(([ep,r])=>{
        if(!/^[1-9]\d*$/.test(ep) || !r || !['seeded','partial','complete'].includes(r.status) || !Array.isArray(r.sources) || (r.notes!==undefined&&typeof r.notes!=='string')) fail('Invalid episode record '+ep+'.');
        r.sources.forEach(s=>{if(!s||typeof s.title!=='string'||typeof s.url!=='string'||!/^https?:\/\//i.test(s.url))fail('Invalid episode source.');});
      });
    }
    if(d.episodeAudit!==undefined && (!Array.isArray(d.episodeAudit) || d.episodeAudit.some(a=>!a||!Number.isInteger(a.episode)||!Array.isArray(a.newEvents)||!Array.isArray(a.previousEvents)||typeof a.approvedAt!=='string'))) fail('Invalid episode revision history.');
    const active=new Set(names), roles=Object.fromEntries(names.map(n=>[n,d.originalTraitors.includes(n)?'Traitor':'Faithful']));
    let lastEp=0,final=false;
    d.events.forEach((e,i)=>{
      const error=m=>fail('Event '+(i+1)+': '+m);
      const present=n=>{ if (!active.has(n)) error('Contestant is missing or no longer active: '+(n||'(choose a name)')); };
      if (!e || !Number.isInteger(e.ep) || e.ep<1 || e.ep<lastEp) error('Episode numbers must be positive and in chronological order.');
      lastEp=e.ep;
      if (final) error('No events may follow the final.');
      if (e.type==='murder') {
        if (e.victim && e.shielded) error('A murder cannot succeed and be prevented by a Shield in the same event.');
        for (const n of [e.victim,e.shielded].filter(Boolean)) { present(n); if(roles[n]!=='Faithful') error('A murder target must be Faithful.'); }
        if(e.victim) active.delete(e.victim);
      } else if (e.type==='recruit') {
        present(e.who); if(roles[e.who]!=='Faithful') error('Only a Faithful can be recruited.');
        if(typeof e.accepted!=='boolean') error('Choose accepted or declined recruitment.');
        if(e.accepted) roles[e.who]='Traitor';
      } else if(e.type==='exit') { present(e.who); active.delete(e.who); }
      else if(e.type==='roundtable') {
        if(!Array.isArray(e.absent) || !unique(e.absent) || e.absent.some(n=>!active.has(n))) error('Absentees must be unique active contestants.');
        const participants=[...active].filter(n=>!e.absent.includes(n));
        if(!participants.length) error('A Round Table needs participants.');
        if(!e.votes || typeof e.votes!=='object' || Array.isArray(e.votes) || !Array.isArray(e.revotes)) error('Invalid voting rounds.');
        if(e.votingComplete !== undefined && typeof e.votingComplete !== 'boolean') error('Voting completeness must be true or false.');
        if(e.votingComplete !== false && participants.some(n=>!e.votes[n])) error('Record every present contestant’s first-round vote, or mark voting incomplete.');
        [e.votes,...e.revotes].forEach((r,j)=>{
          if(!r || typeof r!=='object' || Array.isArray(r)) error('Invalid voting round.');
          if(j && e.votingComplete !== false && !Object.values(r).some(Boolean)) error('Remove empty re-votes or mark voting incomplete.');
          Object.entries(r).forEach(([v,t])=>{ if(t && (!participants.includes(v) || !participants.includes(t) || v===t)) error('Votes must be between different, present contestants. Clear stale votes after changing attendance.'); });
        });
        if(e.banished) { present(e.banished); if(!participants.includes(e.banished)) error('An absent contestant cannot be banished at this table.'); active.delete(e.banished); }
      } else if(e.type==='final') {
        if(!Array.isArray(e.winners) || !e.winners.length || !unique(e.winners)) error('Select the actual winner(s), once each.');
        e.winners.forEach(present);
        if(e.winners.length!==active.size) error('Record all remaining non-winners’ exits before the final.');
        if(new Set(e.winners.map(n=>roles[n])).size!==1) error('Faithful and Traitor contestants cannot win together.');
        final=true;
      } else error('Unknown event type.');
    });
    return d;
  }
  function parse(text) {
    let source=text.replace(/^\uFEFF/,'').trim();
    if(!source.startsWith('{')) {
      source=source.replace(/^(?:\s*\/\/[^\n]*(?:\n|$))*/, '').trim();
      if(!source.startsWith('window.SWEEPSTAKE = ')) throw new Error('Choose an exported data.js or JSON dataset.');
      source=source.slice('window.SWEEPSTAKE = '.length).replace(/;\s*$/,'');
    }
    return validate(JSON.parse(source));
  }
  return {validate,parse};
})();
