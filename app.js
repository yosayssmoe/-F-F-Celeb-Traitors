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
      const s = sc(c.name);
      if (out) {
        let fate = { murdered: "Murdered", banished: "Banished", left: "Left the game" }[s.status];
        if (s.status === "banished") fate += " · " + s.roleAtExit;
        const cls = s.status === "banished" && s.roleAtExit === "Traitor" ? "traitor" : s.status;
        txt.appendChild(el("div", "fate fit " + cls, fate));
      } else if (s.status === "winner") {
        seat.classList.add("won");
        txt.appendChild(el("div", "fate fit winner", "Winner · " + (c.participant || "")));
      } else {
        txt.appendChild(el("div", c.participant ? "who fit" : "who fit none", c.participant || "Unassigned"));
      }
      seat.appendChild(txt);
      seat.title = `${c.name} — ${s.total} pts${c.participant ? " · drawn by " + c.participant : ""} (click for points history)`;
      seat.tabIndex = 0;
      seat.onclick = () => openHistory(c.name);
      seat.onkeydown = (e) => { if (e.key === "Enter") openHistory(c.name); };
      seatsEl.appendChild(seat);
    });

    prevOut = nowOut;
    $("remaining").textContent = state.celebs.filter((c) => !isOut(c)).length;
    fitText();
  }

  // Shrink any line that's too long for its card (e.g. "Julie Hesmondhalgh").
  function fitText() {
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
      if (e.scrollWidth > e.clientWidth) {
        e.style.setProperty("--fit", Math.max(0.55, (e.clientWidth / e.scrollWidth) * 0.98).toFixed(3));
      }
    });
  }
  if (document.fonts) document.fonts.ready.then(fitText);
  let fitW = 0;
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w !== fitW) { fitW = w; fitText(); }
  }).observe(seatsEl);

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

  // ── Countdown ──────────────────────────────────────────
  let eps = state.episodes.map((s) => new Date(s));
  const epLen = (state.episodeLengthMins || 60) * 60000;
  const fmtWhen = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
    hour12: true, timeZone: "Europe/London",
  });
  const pad = (n) => String(n).padStart(2, "0");
  const cd = $("countdown");
  const clock = $("cd-clock");
  const clockHTML = clock.innerHTML;

  function airedCount(now = Date.now()) {
    return eps.filter((d) => d.getTime() <= now).length;
  }

  function tick() {
    const now = Date.now();
    if (!eps.length) { $("cd-label").textContent = "Episode tracker"; clock.innerHTML = '<div class="onair">Awaiting the next twist</div>'; $("cd-when").textContent = "Add confirmed air times in Manage for a countdown."; return; }
    const liveIdx = eps.findIndex((d) => now >= d.getTime() && now < d.getTime() + epLen);
    const nextIdx = eps.findIndex((d) => d.getTime() > now);

    if (liveIdx >= 0) {
      cd.classList.add("live");
      $("cd-label").textContent = liveIdx === eps.length - 1 ? "The Final" : `Episode ${liveIdx + 1}`;
      if (!clock.querySelector(".onair")) clock.innerHTML = '<div class="onair"><i></i>On air now</div>';
      $("cd-when").textContent = "BBC One & iPlayer";
      return;
    }
    cd.classList.remove("live");
    if (!clock.querySelector("#cd-d")) clock.innerHTML = clockHTML;

    if (nextIdx < 0) {
      $("cd-label").textContent = "The series has ended";
      ["cd-d", "cd-h", "cd-m", "cd-s"].forEach((id) => ($(id).textContent = "00"));
      $("cd-when").textContent = "Thanks for playing";
      return;
    }

    const secs = Math.floor((eps[nextIdx].getTime() - now) / 1000);
    $("cd-d").textContent = pad(Math.floor(secs / 86400));
    $("cd-h").textContent = pad(Math.floor((secs % 86400) / 3600));
    $("cd-m").textContent = pad(Math.floor((secs % 3600) / 60));
    $("cd-s").textContent = pad(secs % 60);
    const label = nextIdx === eps.length - 1 ? "The Final" : `Episode ${nextIdx + 1}`;
    $("cd-label").textContent = `Next episode · ${label}`;
    const [day, time] = fmtWhen.format(eps[nextIdx]).split(" at ");
    const when = $("cd-when");
    when.innerHTML = "";
    when.append(el("span", null, day), " · ", el("span", null, time + " · BBC One"));
  }
  tick();
  setInterval(tick, 1000);

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
    const tbody = $("lb-rows");
    tbody.innerHTML = "";
    $("leader-summary").replaceChildren();
    participants().forEach(p => {
      const card = el('div','leader-card');
      card.append(el('span',null,(p.tied?'=':'')+p.rank+' · '+p.name),el('strong',null,p.total),el('small',null,'points'));
      $("leader-summary").appendChild(card);
    });
    participants().forEach((p, pi) => {
      if (!p.celebs.length) { const row = el("tr"); const cell = el("td", null, `${p.rank}. ${p.name} — no assigned contestants — 0 points`); cell.colSpan = 11; row.appendChild(cell); tbody.appendChild(row); }
      p.celebs.forEach((s, i) => {
        const tr = el("tr", "st-" + s.status + (i === 0 ? " first" : "") + (pi % 2 ? " alt" : ""));
        if (i === 0) {
          const rk = el("td", "rk", (p.tied ? "=" : "") + p.rank);
          rk.rowSpan = p.celebs.length;
          tr.appendChild(rk);
          const pn = el("td", "p-name", p.name);
          pn.rowSpan = p.celebs.length;
          tr.appendChild(pn);
        }
        const who = el("td", "who-cell");
        who.appendChild(el("div", "lb-name", s.name));
        const meta = el("div", "lb-meta");
        meta.appendChild(el("span", s.role === "Traitor" ? "is-traitor" : "is-faithful", roleLabel(s)));
        meta.append(" · " + statusLabel(s));
        who.appendChild(meta);
        who.tabIndex = 0;
        who.onclick = () => openHistory(s.name);
        who.onkeydown = (e) => { if (e.key === "Enter") openHistory(s.name); };
        tr.appendChild(who);
        tr.appendChild(el("td", "num bd", s.cols.survival));
        tr.appendChild(el("td", "num bd c-murder" + (s.cols.murder ? " pos" : ""), s.cols.murder ? "+" + s.cols.murder : "0"));
        tr.appendChild(el("td", "num bd c-recruit" + (s.cols.recruitment ? " pos" : ""), s.cols.recruitment ? "+" + s.cols.recruitment : "0"));
        tr.appendChild(el("td", "num bd c-other" + (s.cols.other ? " pos" : ""), s.cols.other ? "+" + s.cols.other : "0"));
        tr.appendChild(el("td", "num bd score", s.celebScore));
        tr.appendChild(el("td", "num bd mult" + (s.multiplier !== 1 ? " x" : ""), "×" + s.multiplier));
        tr.appendChild(el("td", "num contrib", s.contributed));
        if (i === 0) {
          const tot = el("td", "num total", p.total);
          tot.rowSpan = p.celebs.length;
          tr.appendChild(tot);
        }
        tbody.appendChild(tr);
      });
    });
    fitBoard();
  }

  // Keep the scoreboard on one screen: shrink rows until it fits.
  function fitBoard() {
    const board = $("board");
    if (board.hidden) return;
    board.style.setProperty("--bs", "1"); return;
    for (let k = 1; k >= 0.6; k -= 0.03) {
      board.style.setProperty("--bs", k.toFixed(2));
      const table = board.querySelector(".lb"), main = board.querySelector(".board-main");
      if (main.scrollHeight <= main.clientHeight + 1 && table.scrollWidth <= main.clientWidth + 1) break;
    }
  }
  new ResizeObserver(fitBoard).observe($("board"));

  // ── View switch (Round Table / Leaderboard) ────────────
  const params = new URLSearchParams(location.search);
  function setView(v) {
    $("stage").hidden = v !== "table";
    $("board").hidden = v !== "board";
    document.querySelectorAll(".views button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
    if (v === "board") { renderBoard(); }
    else fitText();
  }
  document.querySelectorAll(".views button").forEach((b) => (b.onclick = () => setView(b.dataset.view)));
  // ?rotate=30 flips between the two views every 30s (for the projector)
  const rotate = Number(params.get("rotate"));
  if (rotate > 0) setInterval(() => setView($("board").hidden ? "board" : "table"), rotate * 1000);

  // ── Points history ─────────────────────────────────────
  const histDlg = $("hist");
  function openHistory(name) {
    const s = sc(name);
    const c = state.celebs.find((x) => x.name === name);
    const body = $("hist-body");
    body.innerHTML = "";
    $("hist-name").textContent = name;
    $("hist-sub").textContent = [c.participant ? "Drawn by " + c.participant : "Unassigned", roleLabel(s) + (s.recruitedEp ? " from Ep " + s.recruitedEp : ""), statusLabel(s)].join(" · ");

    const sum = el("div", "hist-sum");
    const box = (val, label, cls) => {
      const b = el("div", "hs " + (cls || ""));
      b.appendChild(el("strong", null, val));
      b.appendChild(el("span", null, label));
      sum.appendChild(b);
    };
    T.COLS.forEach((k) => box(s.cols[k], T.COL_LABEL[k], "c-" + k));
    box(s.celebScore, "Celeb score", "total");
    body.appendChild(sum);
    if (s.multiplier !== 1) {
      body.appendChild(el("p", "hist-mult", `×${s.multiplier} multiplier: contributes ${s.contributed} points to ${c.participant}`));
    }

    // every scoring category, even when zero
    const cats = el("dl", "hist-cats");
    const survivalRow = el("div", "c-survival");
    survivalRow.appendChild(el("dt", null, "Survival"));
    survivalRow.title = s.log[0].note;
    survivalRow.appendChild(el("dd", null, s.survival));
    cats.appendChild(survivalRow);
    Object.entries(T.CATS).forEach(([k, def]) => {
      if (k === "survival") return;
      const label = def.label + (def.role ? " (" + def.role + ")" : "");
      const row = el("div", "c-" + def.col + (s.cats[k] ? "" : " zero"));
      row.appendChild(el("dt", null, label));
      row.appendChild(el("dd", null, s.cats[k] || 0));
      cats.appendChild(row);
    });
    body.appendChild(cats);

    const hist = T.history(s);
    if (!hist.length) body.appendChild(el("p", "hint", "No bonus points yet."));
    hist.forEach((h) => {
      const sec = el("section", "hist-ep");
      sec.appendChild(el("h4", null, h.ep ? "Episode " + h.ep : "Series"));
      const ul = el("ul");
      h.items.forEach((it) => {
        const li = el("li", "c-" + T.CATS[it.cat].col);
        li.appendChild(el("span", null, T.CATS[it.cat].label + (it.note ? " — " + it.note : "")));
        li.appendChild(el("b", null, "+" + it.pts));
        ul.appendChild(li);
      });
      const tl = el("li", "ep-total");
      tl.appendChild(el("span", null, "Episode points · cumulative " + h.cumulative));
      tl.appendChild(el("b", null, "+" + h.pts));
      ul.appendChild(tl);
      sec.appendChild(ul);
      body.appendChild(sec);
    });
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
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || dlg.open || histDlg.open) return;
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
    eps = state.episodes.map(s => new Date(s)); tick(); updateStorageStatus();
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
    $("hist-sub").textContent = "Each table scores once. Re-votes are retained; a vote in any round prevents a zero-vote bonus.";
    const body = $("hist-body"); body.replaceChildren();
    const tables = state.events.filter(e=>e.type==='roundtable');
    if (!tables.length) body.appendChild(el("p", "hint", "No Round Tables recorded yet. Add voting results in Manage."));
    tables.forEach((ev,i)=>{
      const section = el('section','hist-ep');
      section.appendChild(el('h4',null,`Episode ${ev.ep} · Round Table ${i+1}`));
      section.appendChild(el('p',null,ev.banished ? 'Banished: '+ev.banished : 'No banishment'));
      if(ev.votingComplete===false || (ev.votingComplete===undefined && ev.revotes.length)) section.appendChild(el('p','draw-note','Voting completeness not confirmed: zero-vote bonuses withheld.'));
      if (ev.absent.length) section.appendChild(el('p','hint','Absent: '+ev.absent.join(', ')));
      [ev.votes,...ev.revotes].forEach((round,j)=>{
        section.appendChild(el('h5',null,j ? 'Re-vote '+j : 'Initial vote'));
        const tally = {};
        Object.entries(round).forEach(([v,t])=>{
          if (!t || ev.absent.includes(v)) return;
          section.appendChild(el('p','vote-record',v+' → '+t)); tally[t]=(tally[t]||0)+1;
        });
        section.appendChild(el('p','hist-mult','Result: '+Object.entries(tally).sort((a,b)=>b[1]-a[1]).map(([n,v])=>n+' '+v).join(' · ')));
      });
      body.appendChild(section);
    });
    histDlg.showModal();
  };

  // ── Go ─────────────────────────────────────────────────
  renderSeats();
  renderCoffin();
  setView(params.get("view") === "table" ? "table" : "board");
  updateStorageStatus();
  window.AutomationStatus?.render(state);
  window.SweepstakeApp = {
    getState:()=>clone(state),
    applyEpisode: next=>{window.SweepstakeData.validate(next);state=clone(next);persist();refreshAll();},
  };
})();
