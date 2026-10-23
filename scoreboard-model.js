// Presentation only: every total comes from the unchanged event-replay engine.
(function (root) {
  'use strict';
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
      contestants[name] = {...s, previous: prev, delta: prev === null ? null : s.celebScore - prev, history};
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
    });
    return {episode, partial: partial(episode), previousPartial: partial(episode - 1), contestants, participants,
      unavailableReason: available ? null : 'Historical event episode numbers are missing; a previous-episode total cannot be reconstructed.'};
  }
  root.ScoreboardModel = {build};
})(typeof window === 'undefined' ? module.exports : window);
