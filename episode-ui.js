(() => {
  'use strict';
  const $=id=>document.getElementById(id),E=window.EpisodeUpdates,A=window.SweepstakeApp;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const el=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e;};
  let draft,loadedState,review=null,request=null,fetchSerial=0;
  const dialog=$('episode-dialog');
  function status(text,error=false){$('episode-status').textContent=text;$('episode-status').className=error?'episode-warning':'hint';}
  function invalidate(){review=null;$('episode-confirm').checked=false;$('episode-confirm').disabled=true;$('episode-approve').disabled=true;$('episode-review').replaceChildren();}
  function sync(){
    draft.date=$('episode-date').value;draft.status=$('episode-coverage').value;draft.notes=$('episode-notes').value;
    draft.sources=$('episode-sources').value.split('\n').map(s=>s.trim()).filter(Boolean).map(url=>draft.sources.find(s=>s.url===url)||{title:'Manually supplied source',url});
    return draft;
  }
  function fill(){
    $('episode-number').value=draft.episode;$('episode-date').value=draft.date||'';$('episode-coverage').value=draft.status;
    $('episode-notes').value=draft.notes||'';$('episode-sources').value=draft.sources.map(s=>s.url).join('\n');
    invalidate();render();renderAudit();
  }
  function cancelFetch(){fetchSerial++;request?.abort();request=null;$('episode-fetch').disabled=false;}
  function load(ep){
    if(!Number.isInteger(ep)||ep<1||ep>100)throw Error('Choose an episode from 1 to 100.');
    cancelFetch();loadedState=A.getState();draft=E.snapshot(loadedState,ep);fill();$('episode-evidence').replaceChildren();
    status(`Episode ${ep}: ${draft.events.length} saved event(s) loaded. Edits are a draft until approved.`);
  }
  $('episode-update-btn').onclick=()=>{const s=A.getState();load(Math.min(100,Math.max(1,...s.events.map(e=>e.ep))+1));dialog.showModal();};
  $('episode-close').onclick=()=>{cancelFetch();dialog.close();};dialog.addEventListener('cancel',cancelFetch);
  $('episode-load').onclick=()=>{try{if(confirm('Load the selected episode and discard this unapproved draft?'))load(Number($('episode-number').value));}catch(e){status(e.message,true);}};
  // Changing only the selector cannot approve a stale preview for another episode.
  $('episode-number').oninput=()=>{invalidate();status('Click Load episode to change the episode being edited.');};
  ['episode-date','episode-coverage','episode-notes','episode-sources'].forEach(id=>$(id).addEventListener('input',()=>{sync();invalidate();}));
  function checkSelection(){if(Number($('episode-number').value)!==draft.episode)throw Error('Click Load episode before editing or fetching a different episode.');}
  function select(names,value,onchange,label){
    const s=el('select');s.setAttribute('aria-label',label);s.append(new Option('— unknown / none —',''));
    [...new Set([...names,...(value&&!names.includes(value)?[value]:[])])].forEach(n=>s.append(new Option(n,n)));s.value=value||'';
    s.onchange=()=>{onchange(s.value);invalidate();render();};return s;
  }
  function field(parent,label,control){const l=el('label',label,'episode-field');l.append(control);parent.append(l);}
  function change(e,fn){fn();if(e.type==='roundtable')e.votingComplete=false;invalidate();render();}
  function button(text,fn){const b=el('button',text,'btn ghost sm');b.type='button';b.onclick=()=>{fn();invalidate();render();};return b;}
  function render(){
    const list=$('episode-events');list.replaceChildren();
    if(!draft.events.length)list.append(el('li','No scoring events recorded for this episode. Add only confirmed events.','hint'));
    const names=loadedState.celebs.map(c=>c.name);
    let sim;
    try{sim=window.TraitorsScoring.compute({...loadedState,events:[...loadedState.events.filter(e=>e.ep<draft.episode),...draft.events]});}catch(e){status('Draft contains an invalid event. Correct it before approval: '+e.message,true);}
    const offset=loadedState.events.filter(e=>e.ep<draft.episode).length;
    draft.events.forEach((e,i)=>{
      const active=sim?.steps[offset+i]?.active||names,roles=sim?.steps[offset+i]?.roles||{};
      const li=el('li',null,'ev'),head=el('div',null,'ev-head');head.append(el('strong',`${i+1}. ${ {murder:'Murder / Shield save',roundtable:'Round Table',recruit:'Recruitment',exit:'Other exit',final:'Final winners'}[e.type] }`));
      head.append(button('↑',()=>{if(i)[draft.events[i-1],draft.events[i]]=[e,draft.events[i-1]];}),button('↓',()=>{if(i<draft.events.length-1)[draft.events[i+1],draft.events[i]]=[e,draft.events[i+1]];}),button('Remove',()=>{draft.events.splice(i,1);}));li.append(head);
      const body=el('div',null,'ev-body');
      if(e.type==='murder') {
        field(body,'Murder victim',select(active,e.victim,v=>{e.victim=v||null;if(v)e.shielded=null;},'Murder victim'));
        field(body,'Target whose Shield actually blocked murder',select(active.filter(n=>roles[n]==='Faithful'),e.shielded,v=>{e.shielded=v||null;if(v)e.victim=null;},'Shield saved target'));
        body.append(el('p','Holding a Shield alone scores nothing. For a failed attempt without a Shield save, leave both fields empty.','hint'));
      } else if(e.type==='recruit'||e.type==='exit') {
        field(body,'Contestant',select(e.type==='recruit'?active.filter(n=>roles[n]==='Faithful'):active,e.who,v=>e.who=v,'Contestant'));
        if(e.type==='recruit'){const s=el('select');s.append(new Option('Accepted','true'),new Option('Declined','false'));s.value=String(e.accepted);s.onchange=()=>change(e,()=>e.accepted=s.value==='true');field(body,'Recruitment outcome',s);}
      } else if(e.type==='final') {
        active.forEach(n=>{const cb=el('input');cb.type='checkbox';cb.checked=(e.winners||[]).includes(n);cb.onchange=()=>change(e,()=>e.winners=cb.checked?[...(e.winners||[]),n]:(e.winners||[]).filter(x=>x!==n));field(body,n+' · '+roles[n],cb);});
      } else if(e.type==='roundtable') {
        e.votes=e.votes||{};e.revotes=e.revotes||[];e.absent=e.absent||[];
        const present=active.filter(n=>!e.absent.includes(n));
        field(body,'Confirmed banishment',select(present,e.banished,v=>e.banished=v||null,'Banished contestant'));
        const scroll=el('div',null,'episode-votes'),table=el('table',null,'vote-table'),tr=el('tr');['Contestant / role','Present','Initial vote',...e.revotes.map((_,k)=>'Re-vote '+(k+1))].forEach(t=>tr.append(el('th',t)));table.append(tr);
        active.forEach(n=>{
          const row=el('tr');row.append(el('td',n+' · '+roles[n]));const td=el('td'),cb=el('input');cb.type='checkbox';cb.checked=present.includes(n);cb.setAttribute('aria-label',n+' present');
          cb.onchange=()=>change(e,()=>{e.absent=cb.checked?e.absent.filter(x=>x!==n):[...e.absent,n];if(!cb.checked){[e.votes,...e.revotes].forEach(r=>{delete r[n];Object.keys(r).forEach(v=>{if(r[v]===n)delete r[v];});});if(e.banished===n)e.banished=null;}});td.append(cb);row.append(td);
          [e.votes,...e.revotes].forEach((r,k)=>{const cell=el('td');if(present.includes(n))cell.append(select(present.filter(t=>t!==n),r[n],v=>{if(v)r[n]=v;else delete r[n];e.votingComplete=false;},n+(k?' re-vote '+k:' initial vote')));else cell.textContent='Absent';row.append(cell);});table.append(row);
        });scroll.append(table);body.append(scroll);
        body.append(button('+ Re-vote',()=>{e.revotes.push({});e.votingComplete=false;}));
        if(e.revotes.length)body.append(button('Remove last re-vote',()=>{e.revotes.pop();e.votingComplete=false;}));
        const complete=el('input');complete.type='checkbox';complete.checked=e.votingComplete===true;
        complete.onchange=()=>{e.votingComplete=complete.checked;invalidate();};
        field(body,'I confirm the full eligible voting record, including every re-vote. Enable zero-vote bonuses.',complete);
        body.append(el('p','Unknown votes remain blank. Leave the confirmation unchecked until all eligible voters and every round are verified. No zero-vote bonuses are awarded while incomplete.','hint'));
      }
      li.append(body);list.append(li);
    });
  }
  document.querySelectorAll('[data-episode-add]').forEach(b=>b.onclick=()=>{
    try{checkSelection();const type=b.dataset.episodeAdd,e={ep:draft.episode,type,id:`ep${draft.episode}-${type}-${Date.now()}`};
      if(type==='roundtable')Object.assign(e,{votes:{},revotes:[],absent:[],banished:null,votingComplete:false});
      if(type==='recruit')e.accepted=true;if(type==='final')e.winners=[];draft.events.push(e);invalidate();render();
    }catch(e){status(e.message,true);}
  });
  function showEvidence(p,warnings=[]) {
    const box=$('episode-evidence');box.replaceChildren();
    p.sources.forEach(s=>{const a=el('a',s.title+' — '+(s.retrievedAt||'source'));a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';const line=el('p');line.append(a);box.append(line);});
    warnings.forEach(w=>box.append(el('p',w,'episode-warning')));
    box.append(el('pre',JSON.stringify(p,null,2)));$('episode-retrieved').open=true;
  }
  $('episode-fetch').onclick=async()=>{
    try {
      checkSelection();sync();cancelFetch();request=new AbortController();const ticket=fetchSerial,ep=draft.episode;
      $('episode-fetch').disabled=true;status('Fetching Wikipedia results. Nothing will be applied until approved.');
      const timer=setTimeout(()=>request?.abort(),20000);
      try {
        const result=await window.EpisodeSources.fetchEpisode(ep,loadedState,request.signal);
        if(ticket!==fetchSerial||!dialog.open)return;
        const combined=E.combine(draft,result.package);draft=combined.package;fill();showEvidence(result.package,[...result.warnings,...combined.warnings]);
        status('Retrieved a provisional draft. Existing events retained; review conflicts, event order and missing information before approval.');
      } finally {clearTimeout(timer);if(ticket===fetchSerial){request=null;$('episode-fetch').disabled=false;}}
    }catch(e){if(e.name==='AbortError')status('Fetch cancelled or timed out. Use the offline editor or JSON import.',true);else status('Fetch unavailable: '+e.message+' Manual entry and JSON import still work.',true);}
  };
  $('episode-import').onclick=()=>$('episode-file').click();
  $('episode-file').onchange=async()=>{
    try{const file=$('episode-file').files[0];if(!file)return;if(file.size>1000000)throw Error('Episode file must be smaller than 1 MB.');
      const p=E.normalize(JSON.parse((await file.text()).replace(/^\uFEFF/,'')));
      if(!confirm(`Load Episode ${p.episode} from this file? This replaces the unapproved draft, not your saved scores.`))return;
      cancelFetch();loadedState=A.getState();draft=p;fill();showEvidence(p);status('Episode JSON loaded for review. No saved results have changed.');
    }catch(e){status('Import failed: '+e.message,true);}finally{$('episode-file').value='';}
  };
  function showReview(r){
    const box=$('episode-review');box.replaceChildren();box.append(el('h3',`Review Episode ${draft.episode}`));
    r.warnings.forEach(w=>box.append(el('p',w,'episode-warning')));
    if(r.historical)box.append(el('p','Historical correction: later events are retained and their scores have been recalculated. Their validity has also been checked.','hint'));
    const table=el('table',null,'episode-score-preview'),head=el('tr');['Participant','Before','After','Change'].forEach(t=>head.append(el('th',t)));table.append(head);
    Object.keys(r.beforeTotals).forEach(n=>{const row=el('tr');[n,r.beforeTotals[n],r.afterTotals[n],(r.afterTotals[n]-r.beforeTotals[n]>=0?'+':'')+(r.afterTotals[n]-r.beforeTotals[n])].forEach(t=>row.append(el('td',t)));table.append(row);});box.append(table);
    const detail=el('details');detail.append(el('summary','Compare existing and proposed events'));detail.append(el('h4','Existing'),el('pre',JSON.stringify(r.before,null,2)),el('h4','Proposed'),el('pre',JSON.stringify(r.after,null,2)));box.append(detail);
    if(!r.changed)box.append(el('p','Already recorded: no events, metadata or scores will be duplicated.','hint'));
  }
  $('episode-preview').onclick=()=>{
    try{checkSelection();sync();const current=A.getState();review=E.prepare(current,draft);review.baseline=JSON.stringify(current);showReview(review);$('episode-confirm').disabled=!review.changed;$('episode-confirm').checked=false;$('episode-approve').disabled=true;status('Review ready. Confirm below to enable approval.');}
    catch(e){invalidate();status('Cannot approve: '+e.message,true);}
  };
  $('episode-confirm').onchange=()=>$('episode-approve').disabled=!review||!$('episode-confirm').checked;
  $('episode-approve').onclick=()=>{
    try{checkSelection();if(!review||!$('episode-confirm').checked)throw Error('Review the changes and tick the confirmation first.');
      if(JSON.stringify(A.getState())!==review.baseline)throw Error('Saved data changed since review. Review this episode again.');
      A.applyEpisode(review.data);const ep=draft.episode;load(ep);status('Episode '+ep+' approved and recalculated in this browser. Export data.js in Manage, then publish it for everyone.');
    }catch(e){invalidate();status(e.message,true);}
  };
  $('episode-download').onclick=()=>{
    try{checkSelection();const p=E.normalize(sync());const url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)+'\n'],{type:'application/json'}));const a=el('a');a.href=url;a.download=`episode-${p.episode}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){status(e.message,true);}
  };
  function renderAudit(){
    const box=$('episode-audit');box.replaceChildren();
    const rows=(loadedState.episodeAudit||[]).filter(a=>a.episode===draft.episode);
    if(!rows.length)box.append(el('p','No approved revisions yet. Existing starting events are retained.','hint'));
    rows.slice().reverse().forEach(a=>{const d=el('details');d.append(el('summary',a.approvedAt+' · '+a.newEvents.length+' events'),el('pre',JSON.stringify(a,null,2)));box.append(d);});
  }
})();
