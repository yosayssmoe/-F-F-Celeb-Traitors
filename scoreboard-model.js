// Presentation only: every total comes from the unchanged event-replay engine.
(function (root) {
  'use strict';
  const GROUPS = [
    {key:'shared', label:'Shared scoring', cats:['survival','zeroVote','winner']},
    {key:'faithful', label:'Faithful points', cats:['traitorVote','traitorBanished','shield','recruited']},
    {key:'traitor', label:'Traitor points', cats:['murder','faithfulBanished']}
  ];
  function build(data, T) {
    const events = data.events || [], records = data.episodeRecords || {};
    const pending = data.automation?.pendingEvents || [];
    const episode = Math.max(1, ...events.map(e => Number(e.ep) || 0),
      ...Object.entries(records).filter(([, r]) => r.status === 'complete').map(([n]) => Number(n)));
    const partial = n => records[n]?.status === 'partial' || records[n]?.status === 'incomplete' ||
      (data.automation?.partiallyScoredEpisodes || []).includes(n) || pending.some(p => Number(p.episode) === n);
    const current = T.compute(data);
    const available = Array.isArray(data.events) && events.every(e => Number.isInteger(e.ep) && e.ep > 0);
    const previous = available ? T.compute({...data, events: events.filter(e => e.ep < episode)}) : null;
    const contestants = {};
    for (const [name, s] of Object.entries(current.contestants)) {
      // The engine awards its starting point in Episode 1, not before the series.
      const prev = previous ? previous.contestants[name].log.filter(x => x.ep < episode).reduce((a, x) => a + x.pts, 0) : null;
      let cumulative = 0;
      const history = Array.from({length: episode}, (_, i) => {
        const ep = i + 1, items = s.log.filter(x => x.ep === ep), pts = items.reduce((a, x) => a + x.pts, 0);
        cumulative += pts;
        return {ep, items, pts, cumulative, partial: partial(ep),
          roleChanges: items.filter(x => x.cat === 'recruited').map(() => 'Faithful → Traitor'),
          pending: pending.filter(p => Number(p.episode) === ep)};
      });
      const latestGain = s.log.filter(item => item.ep === episode).reduce((total, item) => total + item.pts, 0);
      // A missing award is not proof that an unresolved event earned zero. Only
      // complete historical coverage (or categorical ineligibility) establishes it.
      const through = Math.min(s.exitEp || episode, episode);
      const coverageComplete = Array.from({length:through}, (_, i) => records[i+1]?.status === 'complete' && !partial(i+1)).every(Boolean) &&
        events.filter(e => e.ep <= through && e.type === 'roundtable').every(e => e.votingComplete === true);
      const rolesCertain = Array.from({length:through}, (_, i) => ['complete','seeded'].includes(records[i+1]?.status) && !partial(i+1)).every(Boolean);
      const roles = new Set([s.originalRole, s.role]);
      const categoryCells = Object.fromEntries(Object.entries(T.CATS).map(([key, def]) => {
        const points = s.cats[key] || 0;
        const knownZero = !points && (coverageComplete || (rolesCertain && def.role && !roles.has(def.role)) || (key === 'winner' && ['murdered','banished','left'].includes(s.status)));
        return [key, {points, knownZero:!!knownZero, text:points ? String(points) : knownZero ? '—' : '?'}];
      }));
      contestants[name] = {...s, previous: prev, delta: prev === null ? null : s.celebScore - prev, latestGain, history, categoryCells};
    }
    const players = Object.fromEntries((data.participants || []).map(name => [name, {name, total: 0, celebs: []}]));
    for (const c of data.celebs) if (c.participant) {
      const p = players[c.participant] ||= {name: c.participant, total: 0, celebs: []};
      p.celebs.push(contestants[c.name]); p.total += contestants[c.name].contributed;
    }
    const participants = Object.values(players).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    participants.forEach((p, i) => {
      p.rank = i && participants[i - 1].total === p.total ? participants[i - 1].rank : i + 1;
      p.tied = participants.filter(x => x.total === p.total).length > 1;
      p.celebs.sort((a, b) => b.contributed - a.contributed || a.name.localeCompare(b.name));
      p.latestGain = p.celebs.reduce((total, celeb) => total + celeb.latestGain * celeb.multiplier, 0);
    });
    return {episode, partial: partial(episode), previousPartial: partial(episode - 1), contestants, participants,
      unavailableReason: available ? null : 'Historical event episode numbers are missing; a previous-episode total cannot be reconstructed.'};
  }
  function gainLabel(value) { return {text: value >= 0 ? '+' + value : String(value), kind: value < 0 ? 'negative' : value > 0 ? 'positive' : 'zero'}; }
  function facts(data, T) {
    const model = build(data, T), replay = T.compute(data);
    const rows = data.celebs.map(c => ({name: c.name, status: replay.contestants[c.name].status, received: 0, traitorBallots: 0, shieldsWon: null}));
    const byName = Object.fromEntries(rows.map(r => [r.name, r]));
    // Complete recorded tables alone cannot establish coverage for missing episodes.
    let complete = Array.from({length: model.episode}, (_, i) => data.episodeRecords?.[i + 1]?.status === 'complete' && !(data.automation?.partiallyScoredEpisodes || []).includes(i + 1)).every(Boolean) &&
      !Array.from({length: model.episode}, (_, i) => i + 1).some(n => (data.automation?.pendingEvents || []).some(p => Number(p.episode) === n));
    (data.events || []).forEach((event, index) => {
      if (event.type !== 'roundtable') return;
      const step = replay.steps[index], present = new Set(step.active.filter(name => !(event.absent || []).includes(name)));
      if (event.votingComplete !== true || [...present].some(name => !event.votes?.[name]) || (event.revotes || []).some(round => !Object.values(round).some(Boolean))) complete = false;
      [event.votes || {}, ...(event.revotes || [])].forEach(ballots => {
        for (const [voter, target] of Object.entries(ballots)) {
          if (!target) continue;
          if (!present.has(voter) || !present.has(target) || voter === target) { complete = false; continue; }
          byName[target].received++;
          // Factual ballots include Traitor voters too; scoring eligibility is separate.
          if (step.roles[target] === 'Traitor') byName[voter].traitorBallots++;
        }
      });
    });
    const label = value => complete ? String(value) : value > 0 ? 'At least ' + value : 'Not fully recorded';
    return {episode: model.episode, complete, rows: rows.map(r => ({...r, receivedLabel: label(r.received), traitorBallotsLabel: label(r.traitorBallots), shieldsLabel: 'Unavailable'}))};
  }
  root.ScoreboardModel = {build, facts, gainLabel, GROUPS};
})(typeof window === 'undefined' ? module.exports : window);
