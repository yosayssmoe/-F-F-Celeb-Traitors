// ─────────────────────────────────────────────────────────────
//  SCORING ENGINE
//  Replays the event log in data.js and works out every contestant's
//  status, role and points. Nothing here is entered by hand.
//
//  Celeb score = Survival + Murder + Recruitment + Other
//  Points contributed to a participant = Celeb score × their multiplier
// ─────────────────────────────────────────────────────────────
window.TraitorsScoring = (function () {
  "use strict";

  // Each scoring category, its points and which bucket it counts towards.
  const CATS = {
    // col: which scoreboard column it counts towards
    survival:         { label: "Survival",                         col: "survival", pts: 1 },
    traitorVote:      { label: "Voted for a Traitor",              col: "other",       role: "Faithful", pts: 2 },
    traitorBanished:  { label: "Traitor banished",                 col: "other",       role: "Faithful", pts: 2 },
    shield:           { label: "Survived a murder with a Shield",  col: "other",       role: "Faithful", pts: 2 },
    recruited:        { label: "Recruited as a Traitor",           col: "recruitment", role: "Faithful", pts: 2 },
    murder:           { label: "Successful murder",                col: "murder",      role: "Traitor",  pts: 1 },
    faithfulBanished: { label: "Faithful banished",                col: "other",       role: "Traitor",  pts: 2 },
    zeroVote:         { label: "Received zero votes",              col: "other",                         pts: 1 },
    winner:           { label: "Winner bonus",                     col: "other",                         pts: 5 },
  };
  const COLS = ["survival", "murder", "recruitment", "other"];
  const COL_LABEL = { survival: "Survival", murder: "Murder", recruitment: "Recruitment", other: "Other" };
  const OUT = ["murdered", "banished", "left"];

  function compute(data) {
    const names = data.celebs.map((c) => c.name);
    const total = names.length;
    const originalTraitors = new Set(data.originalTraitors || []);
    const S = {};
    names.forEach((n) => {
      const role = originalTraitors.has(n) ? "Traitor" : "Faithful";
      S[n] = { name: n, originalRole: role, role, status: "active", exitEp: null, position: null,
               roleAtExit: null, recruitedEp: null, cats: {}, log: [] };
    });

    let position = 0;
    const steps = [];   // snapshot before each event, for the editor
    const active = () => names.filter((n) => S[n].status === "active");
    const add = (n, cat, ep, note) => {
      const pts = CATS[cat].pts;
      S[n].cats[cat] = (S[n].cats[cat] || 0) + pts;
      S[n].log.push({ ep, cat, pts, note });
    };
    const leave = (n, status, ep) => {
      const s = S[n];
      s.status = status; s.exitEp = ep; s.position = ++position; s.roleAtExit = s.role;
      active().forEach(w => add(w, "survival", ep, n + " eliminated"));
    };
    const isActive = (n) => S[n] && S[n].status === "active";

    names.forEach(n => add(n, "survival", 1, "Starting survival point"));

    (data.events || []).forEach((ev, i) => {
      steps[i] = { active: active(), roles: Object.fromEntries(names.map((n) => [n, S[n].role])) };
      const ep = ev.ep;

      if (ev.type === "murder") {
        // A Faithful whose Shield stopped the murder gets +2 (and no murder point).
        if (!ev.victim && ev.shielded && isActive(ev.shielded) && S[ev.shielded].role === "Faithful") {
          add(ev.shielded, "shield", ep, "Shield blocked the murder");
        }
        // The whole Traitor team that night gets +1 for a completed murder.
        if (ev.victim && isActive(ev.victim)) {
          active().filter((n) => S[n].role === "Traitor")
            .forEach((t) => add(t, "murder", ep, ev.victim + " murdered"));
          leave(ev.victim, "murdered", ep);
        }
      }

      else if (ev.type === "recruit") {
        // Keeps Faithful points already earned; scores as a Traitor from here on.
        if (ev.accepted !== false && isActive(ev.who) && S[ev.who].role === "Faithful") {
          add(ev.who, "recruited", ep);
          S[ev.who].role = "Traitor";
          S[ev.who].recruitedEp = ep;
        }
      }

      else if (ev.type === "roundtable") {
        // One scoring event, however many re-votes there are.
        const absent = new Set(ev.absent || []);
        const voters = active().filter((n) => !absent.has(n));
        const rounds = [ev.votes || {}].concat(ev.revotes || []);
        const gotVotes = new Set();
        rounds.forEach((r) => voters.forEach((v) => { if (r[v]) gotVotes.add(r[v]); }));
        // Partial records never imply zero votes. New records require an explicit
        // confirmation; legacy complete first-round records remain compatible.
        const votingComplete = (ev.votingComplete === true || (ev.votingComplete === undefined && !(ev.revotes||[]).length)) && voters.every(n => !!ev.votes?.[n]) && (ev.revotes||[]).every(r=>Object.values(r).some(Boolean));

        voters.forEach((p) => {
          const role = S[p].role;
          if (votingComplete && !gotVotes.has(p)) add(p, "zeroVote", ep);
          if (role === "Faithful") {
            const hit = rounds.map((r) => r[p]).find((t) => t && S[t] && S[t].role === "Traitor");
            if (hit) add(p, "traitorVote", ep, "voted for " + hit);
          }
        });

        const b = ev.banished;
        if (b && isActive(b)) {
          const bRole = S[b].role;
          active().filter((n) => n !== b).forEach((n) => {
            if (bRole === "Traitor" && S[n].role === "Faithful") add(n, "traitorBanished", ep, b + " banished");
            if (bRole === "Faithful" && S[n].role === "Traitor") add(n, "faithfulBanished", ep, b + " banished");
          });
          leave(b, "banished", ep);
        }
      }

      else if (ev.type === "exit") {
        if (isActive(ev.who)) leave(ev.who, "left", ep);
      }

      else if (ev.type === "final") {
        (ev.winners || []).filter(isActive).forEach((w) => {
          S[w].status = "winner"; S[w].exitEp = ep; S[w].roleAtExit = S[w].role;
          add(w, "winner", ep);
        });
      }
    });
    steps[(data.events || []).length] = { active: active(), roles: Object.fromEntries(names.map((n) => [n, S[n].role])) };

    // Survival: start on 1, +1 each time someone else is eliminated while
    // you're still in — i.e. the number of people out when you leave, plus
    // one. Winners reach the full 21.
    const eliminated = names.filter((n) => OUT.includes(S[n].status)).length;
    names.forEach((n) => {
      const s = S[n];
      s.survival = s.cats.survival || 0;

      const c = data.celebs.find((x) => x.name === n);
      s.multiplier = (c && c.multiplier) || 1;
      s.cols = { survival: 0, murder: 0, recruitment: 0, other: 0 };
      Object.entries(s.cats).forEach(([cat, pts]) => { s.cols[CATS[cat].col] += pts; });
      s.celebScore = s.cols.survival + s.cols.murder + s.cols.recruitment + s.cols.other;
      s.contributed = s.celebScore * s.multiplier;
      s.total = s.celebScore;   // kept for sorting/tooltips
    });

    return { contestants: S, names, steps, eliminated, total };
  }

  // Scoring history grouped by episode, for the contestant detail view.
  function history(s) {
    const byEp = new Map();
    s.log.slice().sort((a, b) => (a.ep || 0) - (b.ep || 0)).forEach((item) => {
      if (!byEp.has(item.ep)) byEp.set(item.ep, []);
      byEp.get(item.ep).push(item);
    });
    let cumulative = 0;
    return [...byEp.entries()].map(([ep, items]) => ({
      ep, items, pts: items.reduce((t, x) => t + x.pts, 0), cumulative: (cumulative += items.reduce((t,x)=>t+x.pts,0)),
    }));
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  return { compute, history, CATS, COLS, COL_LABEL, ordinal };
})();
