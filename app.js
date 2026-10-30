(function () {
  "use strict";

  const STORAGE_KEY = "friends-family-traitors-v1";
  const BASE = window.SWEEPSTAKE;
  const BASE_JSON = JSON.stringify(BASE);

  const $ = (id) => document.getElementById(id);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ── State ──────────────────────────────────────────────
  // Local edits (from the Manage panel) are kept in localStorage, but are
  // dropped automatically if data.js itself has changed since they were made,
  // so a redeploy always wins.
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && saved.base === BASE_JSON && saved.state) { window.SweepstakeData.validate(saved.state); return saved.state; }
    } catch (e) { /* storage unavailable */ }
    return clone(BASE);
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ base: BASE_JSON, state })); } catch (e) { alert("Browser storage is unavailable. Export data.js to keep your changes before closing this page."); }
  }
  let state = window.EpisodeUpdates.migrate(loadState());
  const T = window.TraitorsScoring;
  let score = T.compute(state);              // everything below reads from this
  const sc = (name) => score.contestants[name];
  const OUT = ["murdered", "banished", "left"];
  const isOut = (c) => OUT.includes(sc(c.name).status);
  function recompute() { score = T.compute(state); }

  if (new URLSearchParams(location.search).has("projector")) document.body.classList.add("projector");

  // ── Helpers ────────────────────────────────────────────
  function initials(name) {
    const parts = name.replace(/[^A-Za-z' -]/g, "").split(/[\s-]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function hoodIcon() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    const use = document.createElementNS(ns, "use");
    use.setAttribute("href", "#hood");
    svg.appendChild(use);
    return svg;
  }

  // ── Place cards ────────────────────────────────────────
  // The 21 blank place cards painted into images/table.webp, measured in the
  // image's own pixels (1312×1199) as [x, y, width, height] of the cream
  // area, clockwise from top centre. Names are written straight onto them.
  const IMG_W = 1312, IMG_H = 1199;
  const CARDS = [
    [602, 249, 107, 37], [758, 267, 107, 38], [896, 300, 111, 39], [1016, 354, 112, 39],
    [1102, 439, 115, 39], [1142, 537, 118, 41], [1134, 645, 122, 41], [1073, 752, 125, 42],
    [978, 841, 125, 42], [833, 899, 127, 42], [675, 935, 129, 42], [508, 935, 129, 42],
    [352, 899, 127, 42], [208, 841, 126, 42], [114, 752, 124, 42], [56, 645, 122, 41],
    [52, 537, 118, 41], [95, 438, 115, 40], [184, 354, 111, 39], [305, 300, 110, 39],
    [447, 267, 107, 38],
  ];
  // Our cards are drawn over the painted ones, a little larger for legibility.
  const CARD_SCALE_W = 1.27, CARD_SCALE_H = 1.6;

  // ── Round table ────────────────────────────────────────
  const seatsEl = $("seats");
  let prevOut = new Set(state.celebs.filter(isOut).map((c) => c.name));

  function renderSeats() {
    seatsEl.innerHTML = "";
    const nowOut = new Set();

    state.celebs.forEach((c, i) => {
      const seat = el("div", "seat");
      const [x, y, w, h] = CARDS[i % CARDS.length];
      const cw = w * CARD_SCALE_W, ch = h * CARD_SCALE_H;
      seat.style.left = ((x + w / 2) / IMG_W) * 100 + "%";
      seat.style.top = ((y + h / 2 - h * 0.08) / IMG_H) * 100 + "%";
      seat.style.width = (cw / IMG_W) * 100 + "%";
      seat.style.height = (ch / IMG_H) * 100 + "%";
      seat.style.setProperty("--mobile-card-height", (ch * 1.25 / IMG_H) * 100 + "%");
      seat.style.setProperty("--mobile-card-width", (w * 1.05 / IMG_W) * 100 + "%");
      seat.style.setProperty("--cw", ((cw / IMG_W) * 100).toFixed(3));

      const out = isOut(c);
      if (out) {
        seat.classList.add("out");
        nowOut.add(c.name);
        if (!prevOut.has(c.name)) seat.classList.add("just-out");
      }

      // Medallion: the painted hood shows through unless there's a photo,
      // or they've left (then it's dimmed with a red ring).
      const medal = el("div", "medal");
      const inner = el("div", "medal-in");
      inner.appendChild(hoodIcon());
      if (!out && c.photo) {
        const img = new Image();
        img.alt = "";
        img.onload = () => { inner.textContent = ""; inner.appendChild(img); };
        img.src = c.photo;
      }
      medal.appendChild(inner);
      seat.appendChild(medal);

      const txt = el("div", "txt");
      const nameEl = el("div", "name fit");
      const words = c.name.split(" ");
      // first name(s) / surname, so a wrap never splits mid-name
      nameEl.appendChild(el("span", "l", words.length > 1 ? words.slice(0, -1).join(" ") + " " : c.name));
      if (words.length > 1) nameEl.appendChild(el("span", "l", words[words.length - 1]));
      txt.appendChild(nameEl);
      txt.appendChild(el("div", c.participant ? "who fit" : "who fit none", c.participant || "Unassigned"));
      const s = sc(c.name);
      seat.classList.add(s.status);
      if (out) {
        let fate = { murdered: "Murdered", banished: "Banished", left: "Left the game" }[s.status];
        if (s.status === "banished") fate += " · " + s.roleAtExit;
        const cls = s.status === "banished" && s.roleAtExit === "Traitor" ? "traitor" : s.status;
        txt.appendChild(el("div", "fate fit " + cls, fate));
      } else if (s.status === "winner") {
        seat.classList.add("won");
        txt.appendChild(el("div", "fate fit winner", "Winner"));
      }
      seat.appendChild(txt);
      seat.title = `${c.name} — ${s.total} pts${c.participant ? " · drawn by " + c.participant : ""} (click for points history)`;
      seat.tabIndex = 0;
      seat.setAttribute("role", "button");
      seat.setAttribute("aria-label", `${c.name}, ${c.participant || "Unassigned"}, ${s.status}, ${s.total} points. Show points history.`);
      seat.onclick = () => openHistory(c.name);
      seat.onfocus = () => {
        if (matchMedia("(max-width: 720px)").matches && $("stage").classList.contains("is-expanded")) seat.scrollIntoView({ block: "nearest", inline: "nearest" });
      };
      seat.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openHistory(c.name); }
      };
      seatsEl.appendChild(seat);
    });

    prevOut = nowOut;
    $("remaining").textContent = state.celebs.filter((c) => !isOut(c)).length;
    fitText();
  }

  // Shrink any line that's too long for its card (e.g. "Julie Hesmondhalgh").
  function fitText() {
    // Hidden views have zero-sized cards. Refit when setView reveals the table.
    if (!seatsEl.getClientRects().length || !seatsEl.clientWidth) return;
    seatsEl.querySelectorAll(".seat").forEach((s) => s.classList.remove("wrap"));
    seatsEl.querySelectorAll(".name").forEach((e) => {
      e.style.setProperty("--fit", 1);
      const spans = e.querySelectorAll(".l");
      if (spans.length < 2) return;
      // only wrap names that would otherwise need shrinking a lot
      if (e.scrollWidth > e.clientWidth * 1.4) e.parentNode.parentNode.classList.add("wrap");
    });
    seatsEl.querySelectorAll(".fit").forEach((e) => {
      e.style.setProperty("--fit", 1);
      for (let pass = 0; pass < 4 && e.scrollWidth > e.clientWidth; pass++) {
        const current = Number(e.style.getPropertyValue("--fit"));
        const fitted = Math.max(0.55, current * (e.clientWidth / e.scrollWidth) * 0.98);
        e.style.setProperty("--fit", fitted.toFixed(3));
        if (fitted === 0.55) break;
      }
    });
  }
  let fitFrame;
  function scheduleFit() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(fitText);
  }
  if (document.fonts) document.fonts.ready.then(scheduleFit);
  let fitW = 0;
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w !== fitW) { fitW = w; scheduleFit(); }
  }).observe(seatsEl);

  // Keep one 1440px logical canvas for both mobile modes. Only its parent
  // transform changes; artwork, typography and seat coordinates scale together.
  const tableWindow = $("table-window");
  function layoutTable() {
    if (!matchMedia("(max-width: 720px)").matches || !tableWindow.clientWidth) return;
    const scale = tableWindow.clientWidth / 1440;
    $("stage").style.setProperty("--table-scale", scale);
    $("stage").style.setProperty("--table-height", (tableWindow.clientWidth * IMG_H / IMG_W) + "px");
  }
  let tableLayoutFrame;
  new ResizeObserver(() => {
    cancelAnimationFrame(tableLayoutFrame);
    tableLayoutFrame = requestAnimationFrame(layoutTable);
  }).observe(tableWindow);
  $("expand-table").onclick = () => {
    const expanded = $("stage").classList.toggle("is-expanded");
    $("expand-table").setAttribute("aria-expanded", String(expanded));
    $("expand-table").textContent = expanded ? "Fit Table" : "Expand Table";
    $("table-help").textContent = expanded ? "Scroll inside the table. Tap a name for details." : "Tap a nameplate for contestant details.";
    layoutTable();
    tableWindow.scrollTop = 0;
    tableWindow.scrollLeft = expanded ? (1440 - tableWindow.clientWidth) / 2 : 0;
    scheduleFit();
  };

  // ── Coffin ─────────────────────────────────────────────
  function renderCoffin() {
    const list = $("coffin-list");
    list.innerHTML = "";
    const byName = Object.fromEntries(state.celebs.map((c) => [c.name, c]));
    const fallen = score.names.map(sc).filter((s) => OUT.includes(s.status))
      .sort((a, b) => a.position - b.position);

    fallen.forEach((s) => {
      const c = byName[s.name];
      const traitor = s.roleAtExit === "Traitor";
      const li = el("li", traitor ? "traitor" : s.status);
      li.appendChild(el("div", "rip-name", c.name));
      li.appendChild(el("div", c.participant ? "rip-who" : "rip-who none", c.participant || "Unassigned"));
      const meta = el("div", "rip-meta");
      if (s.exitEp) meta.appendChild(el("span", "tag", "Ep " + s.exitEp));
      meta.appendChild(el("span", "tag " + s.status, { murdered: "Murdered", banished: "Banished", left: "Left" }[s.status]));
      if (s.status === "banished") meta.appendChild(el("span", "tag " + (traitor ? "traitor" : "faithful"), s.roleAtExit));
      li.appendChild(meta);
      li.onclick = () => openHistory(c.name);
      list.appendChild(li);
    });

    $("fallen-count").textContent = fallen.length;
    $("coffin-empty").hidden = fallen.length > 0;
    list.hidden = fallen.length === 0;
    fitCoffin();
  }

  // Nobody can scroll a projector: shrink the list to fit the coffin, then
  // switch to a denser layout, and only as a last resort slowly auto-scroll.
  function fitCoffin() {
    const list = $("coffin-list");
    const fits = () => list.scrollHeight <= list.clientHeight + 1 && list.scrollWidth <= list.clientWidth + 1;
    list.classList.remove("compact", "scrolling");
    for (const compact of [false, true]) {
      list.classList.toggle("compact", compact);
      for (let rs = 1; rs >= (compact ? 0.62 : 0.8) - 1e-9; rs -= 0.02) {
        list.style.setProperty("--rs", rs.toFixed(2));
        if (fits()) return;
      }
    }
    // last resort: the wrapping layout (never runs out sideways), slowly scrolling
    list.classList.remove("compact");
    list.style.setProperty("--rs", "0.8");
    list.classList.add("scrolling");
  }
  new ResizeObserver(() => fitCoffin()).observe(document.querySelector(".coffin-body"));

  (function autoScroll() {
    const list = $("coffin-list");
    let dir = 1, pauseUntil = 0;
    function step(t) {
      if (list.classList.contains("scrolling") && t > pauseUntil) {
        list.scrollTop += 0.4 * dir;
        const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
        if ((dir > 0 && atEnd) || (dir < 0 && list.scrollTop <= 0)) { dir = -dir; pauseUntil = t + 3000; }
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  })();

  // Air times remain available to the administrator when adding events.
  function airedCount(now = Date.now()) {
    return state.episodes.filter(date => Date.parse(date) <= now).length;
  }

  // ── Scoreboard ─────────────────────────────────────────
  // Laid out as in the games team's deck: one block per participant, a row
  // per celebrity they drew, celeb score × multiplier = points contributed.
  const fmtPts = (n) => (n ? String(n) : "0");

  function roleLabel(s) {
    if (s.originalRole === "Faithful" && s.role === "Traitor") return "Traitor (recruited)";
    return s.role;
  }
  function statusLabel(s) {
    if (s.status === "active") return "Active";
    if (s.status === "winner") return "Winner";
    return { murdered: "Murdered", banished: "Banished", left: "Left" }[s.status] + (s.exitEp ? " · Ep " + s.exitEp : "");
  }
  // Standard competition ranking: 1, 2, 2, 4 … shown as 🥇🥈🥉 or "=4" for ties
  function ranked(rows, key) {
    rows.sort((a, b) => key(b) - key(a) || a.name.localeCompare(b.name));
    let rank = 0, prev = null;
    rows.forEach((r, i) => { const k = key(r); if (k !== prev) { rank = i + 1; prev = k; } r.rank = rank; });
    rows.forEach((r) => { r.tied = rows.filter((x) => x.rank === r.rank).length > 1; });
    return rows;
  }
  const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

  function participants() {
    const players = Object.fromEntries(state.participants.map(name => [name, {name,total:0,celebs:[]}]));
    state.celebs.forEach((c) => {
      if (!c.participant) return;
      const key = c.participant;
      const p = (players[key] = players[key] || { name: key, total: 0, celebs: [] });
      const s = sc(c.name);
      p.total += s.contributed;
      p.celebs.push(s);
    });
    Object.values(players).forEach((p) => p.celebs.sort((a, b) => b.contributed - a.contributed || a.name.localeCompare(b.name)));
    return ranked(Object.values(players), (p) => p.total);
  }

  function renderBoard() {
    const M = window.ScoreboardModel, model = M.build(state, T), table = $("league-table");
    table.querySelectorAll('tbody').forEach(body => body.remove());
    $("league-head").replaceChildren(); $("league-columns").replaceChildren();
    $("score-episode").textContent = (model.seriesStatus ? model.seriesStatus + ' — ' : '') + 'Scores through Episode ' + model.episode + (model.partial ? ' — partially scored' : '');
    $("partial-notice").hidden = !model.partial;
    const columns = ['celebrity', ...M.GROUPS.flatMap(g => g.cats), 'raw', 'contribution'];
    columns.forEach(key => {const col = el('col', 'column-' + key); $("league-columns").appendChild(col);});
    const groups = el('tr'), headings = el('tr');
    const who = el('th', 'league-name', 'Celebrity'); who.rowSpan = 2; who.scope = 'col'; groups.appendChild(who);
    const labels = {survival:'Survival',zeroVote:'Zero votes',winner:'Win',traitorVote:'Voted for a Traitor',traitorBanished:'Traitor banished',shield:'Shield save',recruited:'Recruited',murder:'Successful murder',faithfulBanished:'Faithful banished'};
    M.GROUPS.forEach(group => {
      const th = el('th', 'group-' + group.key, group.label); th.colSpan = group.cats.length; th.scope = 'colgroup'; groups.appendChild(th);
      group.cats.forEach(key => {const heading = el('th', 'group-' + group.key, labels[key]); heading.scope = 'col'; heading.id = 'category-' + key; headings.appendChild(heading);});
    });
    const totals = el('th', 'group-totals', 'Totals'); totals.colSpan = 2; totals.scope = 'colgroup'; groups.appendChild(totals);
    ['Raw total','Contribution'].forEach(label => {const th = el('th', 'group-totals', label); th.scope = 'col'; headings.appendChild(th);});
    $("league-head").append(groups, headings);
    const gain = (value, cls, label) => {
      const formatted = M.gainLabel(value), badge = el('span', 'episode-gain ' + formatted.kind + ' ' + cls, formatted.text);
      badge.setAttribute('aria-label', formatted.text + ' ' + label + ' points in Episode ' + model.episode); return badge;
    };
    model.participants.forEach(p => {
      const body = el('tbody', 'participant-group'); body.dataset.participant = p.name;
      const header = el('tr', 'participant-header'), cell = el('th'); cell.colSpan = columns.length; cell.scope = 'rowgroup';
      const strip = el('div', 'participant-strip');
      const rank = el('span', 'standing-rank', (p.tied ? '=' : '') + p.rank); rank.setAttribute('aria-label', (p.tied ? 'Tied rank ' : 'Rank ') + p.rank);
      const total = el('span', 'participant-score'); total.append(el('strong', 'total', p.total), gain(p.latestGain, 'participant-gain', 'allocated'));
      total.querySelector('strong').setAttribute('aria-label', p.total + ' current participant points');
      strip.append(rank, el('span', 'participant-name', p.name), total); cell.appendChild(strip); header.appendChild(cell); body.appendChild(header);
      p.celebs.forEach(s => {
        const row = el('tr', 'celebrity-row status-' + s.status); row.dataset.celebrity = s.name;
        const nameCell = el('th', 'league-name'); nameCell.scope = 'row';
        nameCell.id = 'league-celebrity-' + state.celebs.findIndex(c => c.name === s.name);
        const button = el('button', 'celebrity-link'); button.type = 'button'; button.setAttribute('aria-label', 'Scoring breakdown for ' + s.name);
        button.appendChild(el('span', 'lb-name', s.name));
        if (s.multiplier !== 1) button.appendChild(el('span', 'multiplier-badge', '×' + s.multiplier));
        button.appendChild(el('span', 'league-meta', roleLabel(s) + ' · ' + statusLabel(s)));
        button.onclick = () => {button.focus({preventScroll:true}); openHistory(s.name);}; nameCell.appendChild(button); row.appendChild(nameCell);
        M.GROUPS.forEach(group => group.cats.forEach(key => {
          const value = s.categoryCells[key], td = el('td', 'category-points group-' + group.key + (value.text === '?' ? ' unresolved' : ''), value.text);
          td.dataset.category = key; td.dataset.points = value.points; td.setAttribute('headers', nameCell.id + ' category-' + key);
          td.setAttribute('aria-label', T.CATS[key].label + ': ' + (value.text === '?' ? 'Not fully verified; no points awarded yet' : value.knownZero ? 'Confirmed zero points' : value.points + ' awarded points'));
          row.appendChild(td);
        }));
        const raw = el('td', 'raw-total group-totals'); raw.append(el('strong', null, s.celebScore), gain(s.latestGain, 'raw-gain', 'raw')); row.appendChild(raw);
        const contribution = el('td', 'contribution group-totals'); contribution.appendChild(el('strong', null, s.contributed));
        if (s.multiplier !== 1) contribution.appendChild(el('small', null, s.celebScore + ' ×' + s.multiplier)); row.appendChild(contribution);
        body.appendChild(row);
      });
      table.appendChild(body);
    });
    fitBoard();
  }
  function fitBoard() {
    const scroll = $("league-scroll");
    if (scroll.clientWidth) scroll.style.setProperty('--league-viewport', scroll.clientWidth + 'px');
  }
  new ResizeObserver(fitBoard).observe($("league-scroll"));
  $("league-scroll").addEventListener('keydown', event => {
    if (event.target !== event.currentTarget) return;
    const scroll = event.currentTarget;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); scroll.scrollLeft += event.key === 'ArrowRight' ? 90 : -90;}
  });

  // ── View switch (Round Table / Leaderboard) ────────────
  const params = new URLSearchParams(location.search);
  function setView(v) {
    if (!['board', 'table', 'rules'].includes(v)) v = 'board';
    document.body.classList.toggle('scoreboard-view', v === 'board');
    document.body.classList.toggle('rules-view', v === 'rules');
    $("stage").hidden = v !== 'table'; $("board").hidden = v !== 'board'; $("sweepstake-rules").hidden = v !== 'rules';
    document.querySelectorAll('.views button').forEach(button => {
      const selected = button.dataset.view === v; button.classList.toggle('on', selected);
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    });
    if (v === 'board') renderBoard();
    if (v === 'table') {
      layoutTable(); fitText(); scheduleFit();
      if (matchMedia('(max-width: 720px)').matches) $("stage").scrollIntoView({block:'nearest'});
    }
  }
  const viewTabs = [...document.querySelectorAll('.views button')];
  viewTabs.forEach((button, index) => {
    button.onclick = () => setView(button.dataset.view);
    button.onkeydown = event => {
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? viewTabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % viewTabs.length : event.key === 'ArrowLeft' ? (index + viewTabs.length - 1) % viewTabs.length : null;
      if (next !== null) {event.preventDefault(); setView(viewTabs[next].dataset.view); viewTabs[next].focus();}
    };
  });
  // ?rotate=30 flips between the two views every 30s (for the projector)
  const rotate = Number(params.get("rotate"));
  if (rotate > 0) setInterval(() => setView($("board").hidden ? "board" : "table"), rotate * 1000);

  // ── Points history ─────────────────────────────────────
  const histDlg = $("hist");
  function openHistory(name) {
    const model = window.ScoreboardModel.build(state, T), s = model.contestants[name];
    const c = state.celebs.find(x => x.name === name), body = $("hist-body");
    body.replaceChildren();
    $("hist-name").textContent = name;
    $("hist-sub").textContent = [c.participant ? 'Drawn by ' + c.participant : 'Unassigned', roleLabel(s), statusLabel(s)].join(' · ');
    const sum = el('div', 'hist-sum');
    [[s.celebScore, 'Raw celebrity score', 'total'], ['×' + s.multiplier, 'Allocation multiplier', ''], [c.participant ? s.contributed : 0, c.participant ? 'Contribution to ' + c.participant : 'Unassigned contribution', '']].forEach(([value, label, cls]) => {
      const box = el('div', 'hs ' + cls); box.append(el('strong', null, value), el('span', null, label)); sum.appendChild(box);
    });
    body.append(sum, el('p', 'hint', 'Awarded points only. Episode ' + model.episode + (model.partial ? ' is partially scored.' : ' is scored.') + ' Initial Episodes 1–2 use the supplied project baseline; later automated additions use verified sources.'));
    const controls = el('div', 'detail-switch'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Scoring detail view');
    const overall = el('section', 'overall-panel'), history = el('section', 'history-panel');
    overall.id = 'celebrity-overall'; history.id = 'celebrity-history'; history.hidden = true;
    const buttons = ['Overall breakdown', 'Episode history'].map((label, i) => {
      const button = el('button', 'btn ghost', label); button.type = 'button'; button.setAttribute('aria-pressed', String(i === 0)); button.setAttribute('aria-controls', i ? history.id : overall.id);
      button.onclick = () => {overall.hidden = !!i; history.hidden = !i; buttons.forEach((b, n) => b.setAttribute('aria-pressed', String(i === n)));};
      controls.appendChild(button); return button;
    });
    body.appendChild(controls);
    overall.appendChild(el('h3', null, 'Overall breakdown'));
    const explanations = {
      survival: 'One starting point in Episode 1, plus one for each other contestant’s elimination outlasted.',
      traitorVote: 'Faithful points for voting for a Traitor; each Round Table counts once, including re-votes.',
      traitorBanished: 'Faithful team bonus when a Traitor is banished.',
      shield: 'Faithful bonus for a Shield stopping a murder.',
      recruited: 'Bonus for accepting recruitment; earlier Faithful points are retained.',
      murder: 'Traitor team points for a successful murder.',
      faithfulBanished: 'Traitor team bonus when a Faithful is banished.',
      zeroVote: 'No votes received across all rounds of a fully recorded Round Table.',
      winner: 'Bonus for being a confirmed winner.'
    };
    const cats = el('dl', 'category-breakdown');
    Object.entries(T.CATS).forEach(([key, def]) => {
      if (!s.cats[key]) return;
      const row = el('div'), term = el('dt', null, def.label), amount = el('dd', null, s.cats[key]);
      term.appendChild(el('small', null, explanations[key])); row.append(term, amount); cats.appendChild(row);
    });
    overall.append(cats, el('p', 'hist-mult', c.participant ? 'Raw total ' + s.celebScore + ' × ' + s.multiplier + ' = ' + s.contributed + ' contribution.' : 'Unassigned: raw points remain in game history and do not count towards a participant total.'));
    history.appendChild(el('h3', null, 'Episode history'));
    s.history.forEach(h => {
      const section = el('section', 'hist-ep');
      section.appendChild(el('h4', null, 'Episode ' + h.ep + (h.partial ? ' — partially scored' : '')));
      if (h.partial) section.appendChild(el('p', 'hint', 'Only confirmed awards are included; unresolved information has not been scored.'));
      h.pending.forEach(p => section.appendChild(el('p', 'hint', p.reason || p.status || 'Awaiting verification')));
      const list = el('ul');
      h.items.forEach(item => {
        const label = item.cat === 'survival' && item.note !== 'Starting survival point' ? 'Survived another contestant’s elimination' : T.CATS[item.cat].label;
        const li = el('li'); li.append(el('span', null, label + (item.note ? ' — ' + item.note : '')), el('b', null, (item.pts > 0 ? '+' : '') + item.pts)); list.appendChild(li);
      });
      if (!h.items.length) list.appendChild(el('li', null, 'No awarded points in this episode.'));
      h.roleChanges.forEach(change => list.appendChild(el('li', null, 'Role change: ' + change)));
      const total = el('li', 'ep-total'); total.append(el('span', null, 'Episode points: ' + h.pts + ' · running raw total'), el('b', null, h.cumulative)); list.appendChild(total);
      section.appendChild(list); history.appendChild(section);
    });
    const pending = state.automation?.pendingEvents || [];
    if (pending.length) {
      const unresolved = el('details', 'pending-detail'); unresolved.appendChild(el('summary', null, 'Unresolved information — no points awarded'));
      pending.forEach(p => unresolved.appendChild(el('p', null, 'Episode ' + p.episode + ': ' + (p.reason || p.status || 'Awaiting verification') + (p.dependencies?.length ? ' · Depends on: ' + p.dependencies.join(', ') : ''))));
      body.appendChild(unresolved);
    }
    body.append(overall, history);
    histDlg.showModal();
  }

  // ── Manage panel ───────────────────────────────────────
  const dlg = $("admin");
  let draft = null;

  function draftParticipants() {
    return $("participants-input").value.split("\n").map((s) => s.trim()).filter(Boolean);
  }
  function wrapTd(child) { const td = el("td"); td.appendChild(child); return td; }
  function select(options, value, onchange, cls) {
    const sel = el("select", cls);
    options.forEach(([v, t]) => {
      const o = el("option", null, t);
      o.value = v;
      if (v === (value || "")) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => onchange(sel.value);
    return sel;
  }

  function renderAdminRows() {
    const names = draftParticipants();
    const tbody = $("admin-rows");
    tbody.innerHTML = "";
    const traitors = new Set(draft.originalTraitors || []);
    draft.celebs.forEach((c) => {
      const tr = el("tr");
      tr.appendChild(el("td", null, c.name));
      const opts = [""].concat(names);
      if (c.participant && !names.includes(c.participant)) opts.push(c.participant);
      tr.appendChild(wrapTd(select(opts.map((n) => [n, n || "— Unassigned —"]), c.participant, (v) => { c.participant = v; })));
      tr.appendChild(wrapTd(select([["1", "×1"], ["2", "×2"], ["3", "×3"]], String(c.multiplier || 1), (v) => {
        if (v === "1") delete c.multiplier; else c.multiplier = Number(v);
      })));
      tr.appendChild(wrapTd(select([["Faithful", "Faithful"], ["Traitor", "Traitor"]], traitors.has(c.name) ? "Traitor" : "Faithful", (v) => {
        const set = new Set(draft.originalTraitors || []);
        v === "Traitor" ? set.add(c.name) : set.delete(c.name);
        draft.originalTraitors = draft.celebs.map((x) => x.name).filter((n) => set.has(n));
        renderLog();
      })));
      tbody.appendChild(tr);
    });
  }

  // Game log editor: every event is edited in place, and the scoring is
  // re-run after each change so the dropdowns only offer who's still in.
  const EVENT_LABEL = { murder: "Murder / attempt", recruit: "Recruitment", roundtable: "Round Table", exit: "Left the game", final: "The Final" };
  function renderLog() {
    const sim = T.compute(draft);
    const list = $("log-list");
    list.innerHTML = "";
    if (!draft.events.length) list.appendChild(el("li", "hint", "No events yet. Add what happened in each episode, in order."));
    draft.events.forEach((ev, i) => {
      const step = sim.steps[i];
      const tag = (n) => n + (step.roles[n] === "Traitor" ? "  (T)" : "");
      const activeOpts = step.active.map((n) => [n, tag(n)]);
      const li = el("li", "ev ev-" + ev.type);

      const head = el("div", "ev-head");
      const ep = el("input"); ep.type = "number"; ep.min = 1; ep.max = 100; ep.value = ev.ep || "";
      ep.onchange = () => { ev.ep = Number(ep.value) || null; renderLog(); };
      const epl = el("label", "ev-ep", "Ep ");
      epl.appendChild(ep);
      head.appendChild(epl);
      head.appendChild(el("strong", null, EVENT_LABEL[ev.type]));
      const tools = el("span", "ev-tools");
      [["↑", -1], ["↓", 1]].forEach(([t, d]) => {
        const b = el("button", "icon-btn", t); b.type = "button"; b.title = d < 0 ? "Move up" : "Move down";
        b.onclick = () => { const j = i + d; if (j < 0 || j >= draft.events.length) return; [draft.events[i], draft.events[j]] = [draft.events[j], draft.events[i]]; renderLog(); };
        tools.appendChild(b);
      });
      const del = el("button", "icon-btn", "✕"); del.type = "button"; del.title = "Delete event";
      del.onclick = () => { if (confirm("Delete this " + EVENT_LABEL[ev.type] + " event?")) { draft.events.splice(i, 1); renderLog(); } };
      tools.appendChild(del);
      head.appendChild(tools);
      li.appendChild(head);

      const body = el("div", "ev-body");
      const field = (label, control) => { const l = el("label", "ev-field", label); l.appendChild(control); body.appendChild(l); };

      if (ev.type === "murder") {
        field("Victim", select([["", "— No murder (Shield, recruitment, twist) —"]].concat(activeOpts), ev.victim, (v) => { ev.victim = v || null; if (v) delete ev.shielded; renderLog(); }));
        if (!ev.victim) {
          field("Target saved by Shield", select([["", "— nobody —"]].concat(step.active.filter((n) => step.roles[n] === "Faithful").map((n) => [n, n])), ev.shielded, (v) => { ev.shielded = v || null; renderLog(); }));
        }
      } else if (ev.type === "recruit") {
        field("Recruited", select([["", "— choose —"]].concat(step.active.filter((n) => step.roles[n] === "Faithful").map((n) => [n, n])), ev.who, (v) => { ev.who = v; renderLog(); }));
        field("Outcome", select([["yes", "Accepted"], ["no", "Declined"]], ev.accepted === false ? "no" : "yes", (v) => { ev.accepted = v === "yes"; renderLog(); }));
      } else if (ev.type === "exit") {
        field("Who left", select([["", "— choose —"]].concat(activeOpts), ev.who, (v) => { ev.who = v; renderLog(); }));
      } else if (ev.type === "final") {
        const box = el("div", "ev-winners");
        step.active.forEach((n) => {
          const l = el("label", "chk");
          const cb = el("input"); cb.type = "checkbox"; cb.checked = (ev.winners || []).includes(n);
          cb.onchange = () => { const w = new Set(ev.winners || []); cb.checked ? w.add(n) : w.delete(n); ev.winners = step.active.filter((x) => w.has(x)); renderLog(); };
          l.appendChild(cb); l.append(" " + tag(n));
          box.appendChild(l);
        });
        body.appendChild(el("div", "hint", "Tick the winner(s). Anyone else still in should be banished in a Round Table above this."));
        body.appendChild(box);
      } else if (ev.type === "roundtable") {
        ev.votes = ev.votes || {}; ev.revotes = ev.revotes || []; ev.absent = ev.absent || [];
        const complete = el('input'); complete.type='checkbox'; complete.checked=ev.votingComplete===true || (ev.votingComplete===undefined && !ev.revotes.length);
        complete.onchange=()=>{ev.votingComplete=complete.checked; renderLog();};
        field('Full voting record confirmed (all rounds)',complete);
        body.appendChild(el('p','hint','Leave unchecked for incomplete records: known correct votes and banishment score, but nobody receives zero-vote points. Confirm all eligible re-voters are recorded before checking.'));
        const present = step.active.filter((n) => !ev.absent.includes(n));
        const targetOpts = [["", "—"]].concat(present.map((n) => [n, tag(n)]));
        const tbl = el("table", "vote-table");
        const hr = el("tr");
        ["Player", "Present", "Vote"].concat(ev.revotes.map((_, k) => "Re-vote " + (k + 1))).forEach((h) => hr.appendChild(el("th", null, h)));
        tbl.appendChild(hr);
        step.active.forEach((n) => {
          const tr = el("tr");
          const isIn = !ev.absent.includes(n);
          if (!isIn) tr.className = "absent";
          tr.appendChild(el("td", null, tag(n)));
          const cb = el("input"); cb.type = "checkbox"; cb.checked = isIn;
          cb.onchange = () => {
            ev.votingComplete = false;
            ev.absent = cb.checked ? ev.absent.filter((x) => x !== n) : ev.absent.concat(n);
            if (!cb.checked) [ev.votes,...ev.revotes].forEach(round => {
              delete round[n]; Object.keys(round).forEach(v => { if (round[v] === n) delete round[v]; });
            });
            if (!cb.checked && ev.banished === n) ev.banished = null;
            renderLog();
          };
          tr.appendChild(wrapTd(cb));
          [ev.votes].concat(ev.revotes).forEach((round) => {
            tr.appendChild(wrapTd(isIn ? select(targetOpts.filter(([v]) => v !== n), round[n], (v) => { ev.votingComplete=false; if (v) round[n] = v; else delete round[n]; renderLog(); }) : el("span", "hint", "absent")));
          });
          tbl.appendChild(tr);
        });
        body.appendChild(tbl);

        const tools2 = el("div", "ev-row");
        const fillSel = select(targetOpts, "", () => {});
        const fill = el("button", "btn ghost sm", "Fill blank votes"); fill.type = "button";
        fill.onclick = () => { const t = fillSel.value; if (!t) return; ev.votingComplete=false; present.forEach((n) => { if (n !== t && !ev.votes[n]) ev.votes[n] = t; }); renderLog(); };
        tools2.append("Fill blank first-round votes with ", fillSel, fill);
        const addRv = el("button", "btn ghost sm", "+ Re-vote"); addRv.type = "button";
        addRv.onclick = () => { ev.votingComplete=false; ev.revotes.push({}); renderLog(); };
        tools2.appendChild(addRv);
        if (ev.revotes.length) {
          const rmRv = el("button", "btn ghost sm", "− Re-vote"); rmRv.type = "button";
          rmRv.onclick = () => { ev.votingComplete=false; ev.revotes.pop(); renderLog(); };
          tools2.appendChild(rmRv);
        }
        body.appendChild(tools2);
        field("Banished", select([["", "— Nobody —"]].concat(step.active.map((n) => [n, tag(n)])), ev.banished, (v) => { ev.banished = v || null; renderLog(); }));
      }
      li.appendChild(body);
      list.appendChild(li);
    });
  }

  function nextEp() {
    const last = draft.events[draft.events.length - 1];
    return Math.max(last ? last.ep || 1 : 1, airedCount());
  }
  document.querySelectorAll("[data-add]").forEach((b) => {
    b.onclick = () => {
      if (draft.events.some(e => e.type === "final")) { alert("Remove the final event before adding later events."); return; }
      const type = b.dataset.add;
      const ev = { ep: nextEp(), type };
      if (type === "roundtable") Object.assign(ev, { votes: {}, revotes: [], absent: [], banished: null, votingComplete:false });
      if (type === "recruit") ev.accepted = true;
      if (type === "final") ev.winners = [];
      draft.events.push(ev);
      renderLog();
      $("log-list").lastElementChild.scrollIntoView({ block: "nearest" });
    };
  });

  function setTab(t) {
    document.querySelectorAll(".admin-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    document.querySelectorAll(".admin-pane").forEach((p) => (p.hidden = p.dataset.pane !== t));
  }
  document.querySelectorAll(".admin-tabs button").forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));

  function openAdmin() {
    draft = clone(state);
    draft.events = draft.events || [];
    $("participants-input").value = draft.participants.join("\n");
    $("schedule-input").value = draft.episodes.join("\n");
    renderAdminRows();
    renderLog();
    dlg.showModal();
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  $("manage-btn").onclick = openAdmin;
  document.addEventListener("keydown", (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || dlg.open || histDlg.open || $("episode-dialog").open) return;
    const k = e.key.toLowerCase();
    if (k === "m") openAdmin();
    if (k === "l") setView($("board").hidden ? "board" : "table");
  });
  $("participants-input").addEventListener("input", renderAdminRows);

  $("draw-btn").onclick = () => {
    const names = shuffle(draftParticipants());
    if (!names.length) { alert("Add some participant names first."); return; }
    if (draft.celebs.some((c) => c.participant) && !confirm("Re-draw? This replaces the current assignments.")) return;
    const order = shuffle(draft.celebs.map((_, i) => i));
    order.forEach((ci, k) => { draft.celebs[ci].participant = names[k % names.length]; });
    renderAdminRows();
  };

  function refreshAll() {
    recompute();
    window.AutomationStatus?.render(state);
    renderSeats();
    renderCoffin();
    updateStorageStatus();
    if (!$("board").hidden) renderBoard();
  }

  $("save-btn").onclick = () => {
    draft.participants = draftParticipants();
    draft.episodes = $("schedule-input").value.split("\n").map(s=>s.trim()).filter(Boolean);
    try { window.SweepstakeData.validate(draft); } catch(e) { alert(e.message); return; }
    state = window.EpisodeUpdates.recordManualEdit(state,draft);
    persist();
    refreshAll();
    dlg.close();
  };

  $("reset-btn").onclick = () => {
    if (!confirm("Discard changes made in this browser and go back to data.js?")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    state = window.EpisodeUpdates.migrate(clone(BASE));
    refreshAll();
    dlg.close();
  };

  $("export-btn").onclick = () => {
    const data = clone(draft);
    data.participants = draftParticipants();
    data.episodes = $("schedule-input").value.split("\n").map(s=>s.trim()).filter(Boolean);
    try { window.SweepstakeData.validate(data); } catch(e) { alert(e.message); return; }
      const src =
      "// Sweepstake data — exported " + new Date().toLocaleString("en-GB") + "\n" +
      "// Points are calculated from `events` by scoring.js — see the README for the event format.\n\n" +
      "window.SWEEPSTAKE = " + JSON.stringify(data, null, 2) + ";\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    a.download = "data.js";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  function updateStorageStatus() {
    let saved = false;
    try { saved = !!localStorage.getItem(STORAGE_KEY); } catch(e) {}
    $("storage-status").textContent = saved ? "Viewing this browser’s saved copy. Export data.js and publish it to share updates." : "Viewing packaged data.js. Manage changes are saved only in this browser.";
  }
  $("import-btn").onclick = () => $("import-file").click();
  $("import-file").onchange = async () => {
    const file = $("import-file").files[0];
    if (!file) return;
    try {
      if (file.size > 2000000) throw new Error("Please choose a data file smaller than 2 MB.");
      const imported = window.SweepstakeData.parse(await file.text());
      if (!confirm("Replace this browser’s current data with the imported data?")) return;
      state = window.EpisodeUpdates.migrate(imported); persist(); refreshAll(); dlg.close();
    } catch(e) { alert("Import failed: " + e.message); }
    finally { $("import-file").value = ""; }
  };
  $("votes-btn").onclick = () => {
    $("hist-name").textContent = "Round Table vote history";
    $("hist-sub").textContent = "Each table scores once. Extra ballots and re-votes count towards votes received; incomplete records withhold zero-vote bonuses.";
    const body = $("hist-body"); body.replaceChildren();
    const tables = state.events.filter(e=>e.type==='roundtable');
    if (!tables.length) body.appendChild(el("p", "hint", "No Round Tables recorded yet. Add voting results in Manage."));
    tables.forEach((ev,i)=>{
      const section = el('section','hist-ep');
      section.appendChild(el('h4',null,`Episode ${ev.ep} · Round Table ${i+1}`));
      section.appendChild(el('p',null,ev.banished ? 'Banished: '+ev.banished : ev.outcome?.status==='pending' ? 'Outcome pending: tied Round Table, final result not verified.' : 'No banishment'));
      (ev.ballotPowers||[]).forEach(p=>section.appendChild(el('p','hint',p.holder+': '+(p.kind==='double-vote'?'vote counts twice for the same target':'verified extra vote'))));
      if(ev.votingComplete===false || (ev.votingComplete===undefined && ev.revotes.length)) section.appendChild(el('p','draw-note','Voting completeness not confirmed: zero-vote bonuses withheld.'));
      if (ev.absent.length) section.appendChild(el('p','hint','Absent: '+ev.absent.join(', ')));
      [ev.votes,...ev.revotes].forEach((round,j)=>{
        section.appendChild(el('h5',null,j ? 'Re-vote '+j : 'Initial vote'));
        const tally = {};
        Object.entries(round).forEach(([v,t])=>{
          if (!t || ev.absent.includes(v)) return;
          section.appendChild(el('p','vote-record',v+' → '+t)); tally[t]=(tally[t]||0)+1;
        });
        (ev.extraBallots||[]).filter(b=>b.round===j).forEach(b=>{
          section.appendChild(el('p','vote-record',b.voter+' → '+b.target+' (extra ballot)'));tally[b.target]=(tally[b.target]||0)+1;
        });
        section.appendChild(el('p','hist-mult','Recorded tally: '+Object.entries(tally).sort((a,b)=>b[1]-a[1]).map(([n,v])=>n+' '+v).join(' · ')));
      });
      body.appendChild(section);
    });
    histDlg.showModal();
  };

  // ── Go ─────────────────────────────────────────────────
  renderSeats();
  renderCoffin();
  setView(params.get("view") || "board");
  updateStorageStatus();
  window.AutomationStatus?.render(state);
  window.SweepstakeApp = {
    getState:()=>clone(state),
    applyEpisode: next=>{window.SweepstakeData.validate(next);state=clone(next);persist();refreshAll();},
  };
})();
