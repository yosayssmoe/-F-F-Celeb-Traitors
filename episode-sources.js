/* Conservative Wikipedia adapter. No prose guessing, colour-based role guesses,
   Shield-holder bonuses, inferred votes, or automatic approval. */
window.EpisodeSources = (() => {
  const PAGE='The_Celebrity_Traitors_series_2';
  const URL_BASE='https://en.wikipedia.org/wiki/'+PAGE;
  const API='https://en.wikipedia.org/w/api.php?action=parse&page='+PAGE+'&prop=text%7Crevid&format=json&origin=*';
  function extract(html,episode,data,revision,retrievedAt=new Date().toISOString()) {
    // A detached template is inert: fetched HTML is never inserted into the page.
    const template=document.createElement('template');template.innerHTML=html;
    template.content.querySelectorAll('sup,script,style').forEach(e=>e.remove());
    const text=cell=>(cell?.textContent||'').replace(/\s+/g,' ').trim();
    const aliases=new Map();
    data.celebs.forEach(c=>{
      const parts=c.name.split(' '); const short=parts[0];
      [c.name,short,short+' '+(parts[1]?.[0]||'')+'.'].forEach(a=>{const key=a.toLowerCase();aliases.set(key,aliases.has(key)&&aliases.get(key)!==c.name?null:c.name);});
    });
    [['James A.','James Acaster'],['James B.','James Blunt'],['Kenny','King Kenny'],['Leigh-Anne','Leigh-Anne Pinnock']].forEach(([a,n])=>aliases.set(a.toLowerCase(),n));
    const name=s=>aliases.get(s.trim().toLowerCase())||null;
    const warnings=['Verify event order, attendance, all re-votes, recruitment timing, Shield saves and final winners against the episode. Wikipedia may be incomplete or edited incorrectly.'];
    const observations=[],events=[];
    let found=false,date='';
    const source={title:'Wikipedia — Celebrity Traitors UK Series 2',url:revision?'https://en.wikipedia.org/w/index.php?oldid='+revision:URL_BASE,retrievedAt,revision:revision||null};
    const grid=table=>{
      const rows=[];
      [...table.rows].forEach((tr,r)=>{
        rows[r]=rows[r]||[];let col=0;
        [...tr.cells].forEach(cell=>{
          while(rows[r][col]) col++;
          const v={text:text(cell),cell};
          for(let y=0;y<Math.min(cell.rowSpan||1,100);y++) for(let x=0;x<Math.min(cell.colSpan||1,100);x++){rows[r+y]=rows[r+y]||[];rows[r+y][col+x]=v;}
          col+=cell.colSpan||1;
        });
      });return rows;
    };
    const tables=[...template.content.querySelectorAll('table.wikitable')];
    for(const table of tables) {
      const g=grid(table),header=g.findIndex(row=>row.some(v=>v.text==='Episode')&&row.some(v=>/^\d+$/.test(v.text)));
      if(header<0 || !/Banishment/.test(text(table)) || !/Decision/.test(text(table))) continue;
      const columns=g[header].flatMap((v,i)=>v.text===String(episode)?[i]:[]);
      if(!columns.length) continue;found=true;
      const start=g[header].findIndex(v=>/^\d+$/.test(v.text));
      const decisionIndex=g.findIndex(row=>row.slice(0,start).some(v=>/Traitors.*Decision/.test(v.text)));
      if(decisionIndex>=0) {
        const seen=new Set();
        columns.forEach(c=>{
          const target=g[decisionIndex][c],kind=g[decisionIndex+1]?.[c];
          if(!target||!kind||!target.text||seen.has(target.cell)) return;seen.add(target.cell);
          observations.push(kind.text+': '+target.text);
          const who=name(target.text),action=kind.text.toLowerCase();
          if(who && action==='murder') events.push({ep:episode,type:'murder',victim:who});
          else if(who && action==='recruit') events.push({ep:episode,type:'recruit',who,accepted:true});
          else if(who && /^(shield save|murder blocked by shield)$/.test(action)) events.push({ep:episode,type:'murder',shielded:who});
          else if(action==='shield') warnings.push(target.text+': Shield possession is recorded as an observation only. No prevented murder is inferred.');
          else if(!/^(shortlist|none|no murder|shield)$/.test(action)) warnings.push('Unmapped decision: '+kind.text+' / '+target.text+'. Enter it manually if confirmed.');
        });
      }
      const banishment=g.find(row=>row.slice(0,start).some(v=>v.text==='Banishment'));
      const banished=[...new Set(columns.map(c=>name(banishment?.[c]?.text||'')).filter(Boolean))];
      const contestants=g.filter(row=>row.slice(0,start).some(v=>name(v.text)));
      const rounds=[],seenRoundCells=new Set();
      columns.forEach(c=>{
        const physical=contestants.map(row=>row[c]?.cell);
        if(!physical.length) return;
        // Merged columns share the same cells and are not extra voting rounds.
        const marker=physical.map(cell=>{if(!cell)return '-';return [...table.querySelectorAll('th,td')].indexOf(cell)}).join(',');
        if(seenRoundCells.has(marker)) return;seenRoundCells.add(marker);
        const votes={};
        contestants.forEach(row=>{
          const voter=row.slice(0,start).map(v=>name(v.text)).find(Boolean),target=name(row[c]?.text||'');
          if(voter && target) votes[voter]=target;
          else if(voter && row[c]?.text && !/^(no vote|none|murdered|banished|left|not eligible|ineligible|—|–|-|winner)/i.test(row[c].text)) warnings.push('Unrecognised vote for '+voter+': '+row[c].text);
        });
        if(Object.keys(votes).length) rounds.push(votes);
      });
      if(banished.length>1) warnings.push('Multiple banishments in this episode: split the voting rounds into separate tables manually. No Round Table events were inferred.');
      else if(rounds.length || banished.length) {
        events.push({ep:episode,type:'roundtable',votes:rounds[0]||{},revotes:rounds.slice(1),absent:[],banished:banished[0]||null,votingComplete:false});
        warnings.push('Imported votes are provisional. Confirm absent/ineligible contestants and whether repeated columns are re-votes or separate tables. Zero-vote bonuses remain disabled.');
      }
    }
    // Episode title and date have a separate, explicit table row.
    template.content.querySelectorAll('tr.vevent').forEach(row=>{
      if(text(row.querySelector('.summary'))===`"Episode ${episode}"` || text(row.querySelector('.summary'))===`Episode ${episode}`) {
        date=text(row.querySelector('.bday, .dtstart')).match(/\d{4}-\d{2}-\d{2}/)?.[0]||'';
      }
    });
    if(!found) throw Error('No recognised episode column in the voting table. The source layout may have changed or the episode is not listed. Use manual entry or episode JSON.');
    if(!events.length) warnings.push('No unambiguous scoring events found for this episode. This does not confirm that nothing happened; the episode may be unaired or the source incomplete.');
    events.forEach((e,i)=>e.id=`ep${episode}-${e.type}-${i+1}`);
    return {package:{schemaVersion:1,series:window.EpisodeUpdates.SERIES,episode,date,status:'partial',notes:'Wikipedia proposal; review required.\n'+observations.join('\n'),sources:[source],events},warnings,observations};
  }
  async function fetchEpisode(episode,data,signal) {
    const response=await fetch(API,{signal,credentials:'omit',cache:'no-store'});
    if(!response.ok) throw Error('Wikipedia returned HTTP '+response.status+'. Use manual entry or JSON import.');
    const json=await response.json();
    if(json.error || !json.parse?.text?.['*']) throw Error('Wikipedia API returned no readable article. Use manual entry or JSON import.');
    return extract(json.parse.text['*'],episode,data,json.parse.revid);
  }
  return {extract,fetchEpisode,API,URL_BASE};
})();
