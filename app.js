/* Crossword · cseta.uk
 * Static, dependency-free crossword player.
 * Progress is kept in localStorage and can be exported/imported as a
 * portable base64 key (format documented in README.md).
 */
(function () {
  "use strict";

  const PUZZLES = Array.isArray(window.PUZZLES) ? window.PUZZLES : [];
  const STORAGE_KEY = "cseta-crossword:v1";
  const KEY_PREFIX = "CSX1";
  const MAX_KEY_LENGTH = 50000;
  const MAX_TIME = 100 * 3600; // 100 hours, sanity cap
  const DEFAULT_PUZZLE = "general-mixed";
  const CATEGORY_ORDER = ["General knowledge", "Cyber security"];
  const REDUCED_MOTION = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* ------------------------------------------------------------------ *
   * Model
   * ------------------------------------------------------------------ */

  // Build an indexed model of each puzzle once.
  const MODELS = new Map();
  for (const p of PUZZLES) MODELS.set(p.id, buildModel(p));

  function buildModel(p) {
    const cells = new Array(p.rows * p.cols).fill(null);
    const entries = p.entries.map((e, ei) => {
      const dr = e.dir === "across" ? 0 : 1;
      const dc = e.dir === "across" ? 1 : 0;
      const idxs = [];
      for (let k = 0; k < e.answer.length; k++) {
        const r = e.row + dr * k;
        const c = e.col + dc * k;
        const gi = r * p.cols + c;
        if (!cells[gi]) cells[gi] = { gi, r, c, ans: e.answer[k], num: null, across: null, down: null, li: -1 };
        cells[gi][e.dir] = ei;
        idxs.push(gi);
      }
      cells[idxs[0]].num = e.num;
      return { ...e, ei, cells: idxs };
    });
    const letterCells = [];
    cells.forEach((c) => { if (c) { c.li = letterCells.length; letterCells.push(c.gi); } });
    const order = entries
      .slice()
      .sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === "across" ? -1 : 1))
      .map((e) => e.ei);
    return { ...p, cells, entries, letterCells, order };
  }

  function blankState(m) {
    return { letters: new Array(m.letterCells.length).fill(""), revealed: new Set(), wrong: new Set(), time: 0 };
  }

  const states = new Map(); // id -> state
  const stateFor = (id) => {
    if (!states.has(id)) states.set(id, blankState(MODELS.get(id)));
    return states.get(id);
  };

  /* ------------------------------------------------------------------ *
   * Progress key: CSX1.<base64url(JSON)>.<fnv1a-32 hex of the base64>
   * JSON: { v:1, a:"<active id>", p:{ "<id>": { g:"<grid>", t:<secs> } } }
   * grid: one char per letter cell in reading order.
   *   A-Z typed, a-z revealed, "." empty; runs of 2+ "." as "<n>."
   * ------------------------------------------------------------------ */

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  const toB64Url = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const fromB64Url = (s) => {
    const b = s.replace(/-/g, "+").replace(/_/g, "/");
    return atob(b + "===".slice((b.length + 3) % 4));
  };

  function gridString(m, s) {
    let out = "";
    for (let i = 0; i < m.letterCells.length; i++) {
      const ch = s.letters[i];
      out += !ch ? "." : s.revealed.has(i) ? ch.toLowerCase() : ch;
    }
    return out.replace(/\.{2,}/g, (run) => run.length + ".");
  }

  function parseGrid(str, size) {
    const letters = [];
    const revealed = new Set();
    let i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (ch >= "0" && ch <= "9") {
        let j = i;
        while (j < str.length && str[j] >= "0" && str[j] <= "9") j++;
        if (str[j] !== "." || j - i > 4) return null;
        const n = parseInt(str.slice(i, j), 10);
        if (n < 2 || letters.length + n > size) return null;
        for (let k = 0; k < n; k++) letters.push("");
        i = j + 1;
      } else if (ch === ".") {
        letters.push(""); i++;
      } else if (/^[A-Z]$/.test(ch)) {
        letters.push(ch); i++;
      } else if (/^[a-z]$/.test(ch)) {
        revealed.add(letters.length);
        letters.push(ch.toUpperCase()); i++;
      } else {
        return null;
      }
      if (letters.length > size) return null;
    }
    return letters.length === size ? { letters, revealed } : null;
  }

  const hasProgress = (s) => s.time > 0 || s.letters.some(Boolean);

  function encodeKey() {
    const payload = { v: 1, a: current.id, p: {} };
    for (const [id, s] of states) {
      if (!hasProgress(s)) continue;
      payload.p[id] = { g: gridString(MODELS.get(id), s), t: Math.floor(s.time) };
    }
    const body = toB64Url(JSON.stringify(payload));
    return `${KEY_PREFIX}.${body}.${fnv1a(body)}`;
  }

  // Returns { ok:true, states:Map, active, skipped } or { ok:false, error }
  function decodeKey(raw) {
    if (typeof raw !== "string") return { ok: false, error: "No key supplied." };
    const key = raw.replace(/\s+/g, "");
    if (!key) return { ok: false, error: "Paste your key first." };
    if (key.length > MAX_KEY_LENGTH) return { ok: false, error: "That key is too long to be valid." };
    const m = /^CSX1\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(key);
    if (!m) return { ok: false, error: "That doesn't look like a crossword key. It should start with CSX1." };
    if (fnv1a(m[1]) !== m[2]) return { ok: false, error: "The key is incomplete or has been altered. Check you copied all of it." };

    let data;
    try { data = JSON.parse(fromB64Url(m[1])); } catch (_) { return { ok: false, error: "The key couldn't be read." }; }
    if (!data || typeof data !== "object" || Array.isArray(data) || data.v !== 1) {
      return { ok: false, error: "This key is from an unsupported version." };
    }
    const p = data.p;
    if (!p || typeof p !== "object" || Array.isArray(p)) return { ok: false, error: "The key has no progress in it." };

    const out = new Map();
    let skipped = 0;
    for (const id of Object.keys(p)) {
      const model = MODELS.get(id);
      const entry = p[id];
      if (!model || !entry || typeof entry !== "object" || typeof entry.g !== "string" || entry.g.length > 4000) { skipped++; continue; }
      const grid = parseGrid(entry.g, model.letterCells.length);
      if (!grid) { skipped++; continue; }
      const t = Number.isInteger(entry.t) && entry.t >= 0 && entry.t <= MAX_TIME ? entry.t : 0;
      out.set(id, { letters: grid.letters, revealed: grid.revealed, wrong: new Set(), time: t });
    }
    if (!out.size) return { ok: false, error: "No puzzles in this key match the puzzles on this site." };
    const active = typeof data.a === "string" && MODELS.has(data.a) ? data.a : out.keys().next().value;
    return { ok: true, states: out, active, skipped };
  }

  /* ------------------------------------------------------------------ *
   * Local persistence (convenience only; the key is the portable copy)
   * ------------------------------------------------------------------ */

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    if (!current) return;
    try { localStorage.setItem(STORAGE_KEY, encodeKey()); } catch (_) { /* storage unavailable */ }
  }
  function loadLocal() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
    if (!raw) return null;
    const res = decodeKey(raw);
    return res.ok ? res : null;
  }

  /* ------------------------------------------------------------------ *
   * View state
   * ------------------------------------------------------------------ */

  let current = null;   // model
  let S = null;         // state for current
  let pos = -1;         // grid index of the active cell
  let dir = "across";
  let cellEls = [];

  const board = $("#board");
  const banner = $("#banner");

  function openPuzzle(id) {
    if (!MODELS.has(id)) id = defaultPuzzleId();
    current = MODELS.get(id);
    S = stateFor(id);
    S.wrong.clear();
    dir = "across";
    const firstEntry = current.entries[current.order[0]];
    dir = firstEntry.dir;
    pos = firstEmptyIn(firstEntry);

    $("#puzzle-title").textContent = current.title;
    const meta = $("#puzzle-meta");
    meta.textContent = "";
    const cat = el("span", current.category === "Cyber security" ? "cat-cyber" : "cat-general", current.category);
    meta.append(cat, document.createTextNode(` · ${current.difficulty} · ${current.rows}×${current.cols}`));
    document.title = `${current.title} · Crossword · cseta.uk`;
    try { history.replaceState(null, "", `#${id}`); } catch (_) { /* file:// etc. */ }

    buildBoard();
    buildClues();
    renderPicker();
    hideBanner();
    if (isSolved()) showSolved(false);
    render();
    renderTimer();
    scheduleSave();
  }

  function buildBoard() {
    board.textContent = "";
    board.classList.remove("solved");
    board.style.setProperty("--cols", current.cols);
    board.style.setProperty("--rows", current.rows);
    cellEls = new Array(current.cells.length);
    current.cells.forEach((c, gi) => {
      const d = el("div", c ? "cell letter" : "cell");
      if (c) {
        d.dataset.gi = gi;
        if (c.num) d.append(el("span", "n", String(c.num)));
        d.append(el("span", "ch"));
      }
      cellEls[gi] = d;
      board.append(d);
    });
  }

  function buildClues() {
    const lists = { across: $("#clues-across"), down: $("#clues-down") };
    lists.across.textContent = "";
    lists.down.textContent = "";
    for (const ei of current.order) {
      const e = current.entries[ei];
      const li = el("li");
      li.dataset.ei = ei;
      li.tabIndex = 0;
      const txt = el("span", "txt");
      txt.append(document.createTextNode(e.clue + " "), el("span", "enum", e.enum));
      li.append(el("span", "num", String(e.num)), txt);
      e.li = li;
      lists[e.dir].append(li);
    }
  }

  function renderPicker() {
    const nav = $("#picker");
    nav.textContent = "";
    const groups = new Map();
    for (const p of PUZZLES) {
      if (!groups.has(p.category)) groups.set(p.category, []);
      groups.get(p.category).push(p);
    }
    const rank = (cat) => { const i = CATEGORY_ORDER.indexOf(cat); return i < 0 ? CATEGORY_ORDER.length : i; };
    const ordered = [...groups].sort((a, b) => rank(a[0]) - rank(b[0]));
    for (const [cat, list] of ordered) {
      const g = el("div", "picker-group");
      g.append(el("span", "picker-label", cat));
      for (const p of list) {
        const m = MODELS.get(p.id);
        const s = states.get(p.id);
        const filled = s ? s.letters.filter(Boolean).length : 0;
        const pct = Math.round((filled / m.letterCells.length) * 100);
        const solved = s && filled === m.letterCells.length && isSolved(m, s);
        const b = el("button", "chip" + (solved ? " done" : ""));
        b.type = "button";
        b.dataset.id = p.id;
        b.dataset.cat = cat === "Cyber security" ? "cyber" : "general";
        if (current && current.id === p.id) b.setAttribute("aria-current", "true");
        b.append(el("span", "", p.title), el("span", "pct", solved ? "✓" : pct ? `${pct}%` : p.difficulty));
        g.append(b);
      }
      nav.append(g);
    }
  }

  function render() {
    const e = activeEntry();
    const cross = crossEntry();
    const inWord = new Set(e ? e.cells : []);
    current.cells.forEach((c, gi) => {
      if (!c) return;
      const d = cellEls[gi];
      const ch = S.letters[c.li];
      d.querySelector(".ch").textContent = ch;
      d.classList.toggle("active", gi === pos);
      d.classList.toggle("word", inWord.has(gi) && gi !== pos);
      d.classList.toggle("wrong", S.wrong.has(c.li));
      d.classList.toggle("revealed", S.revealed.has(c.li));
    });

    for (const en of current.entries) {
      const full = en.cells.every((gi) => S.letters[current.cells[gi].li]);
      en.li.classList.toggle("filled", full);
      en.li.classList.toggle("current", en === e);
      en.li.classList.toggle("cross", en === cross);
    }

    const bar = $("#current-clue");
    bar.textContent = "";
    if (e) {
      bar.append(
        el("span", "num", `${e.num}${e.dir === "across" ? "A" : "D"}`),
        document.createTextNode(e.clue),
        el("span", "enum", e.enum)
      );
      scrollClueIntoView(e.li);
      if (cross) scrollClueIntoView(cross.li);
    }
  }

  function scrollClueIntoView(li) {
    const box = li.closest(".clue-col");
    if (!box) return;
    const top = li.offsetTop - box.offsetTop;
    if (top < box.scrollTop + 30 || top + li.offsetHeight > box.scrollTop + box.clientHeight - 10) {
      box.scrollTop = Math.max(0, top - box.clientHeight / 3);
    }
  }

  /* ------------------------------------------------------------------ *
   * Navigation helpers
   * ------------------------------------------------------------------ */

  const cellAt = (gi) => current.cells[gi];
  const activeEntry = () => {
    const c = cellAt(pos);
    if (!c) return null;
    const ei = c[dir];
    return ei === null ? null : current.entries[ei];
  };
  const crossEntry = () => {
    const c = cellAt(pos);
    if (!c) return null;
    const ei = c[dir === "across" ? "down" : "across"];
    return ei === null ? null : current.entries[ei];
  };

  function firstEmptyIn(e) {
    for (const gi of e.cells) if (!S.letters[cellAt(gi).li]) return gi;
    return e.cells[0];
  }

  function select(gi, preferDir) {
    const c = cellAt(gi);
    if (!c) return;
    pos = gi;
    if (preferDir && c[preferDir] !== null) dir = preferDir;
    else if (c[dir] === null) dir = dir === "across" ? "down" : "across";
    render();
  }

  function toggleDir() {
    const c = cellAt(pos);
    const other = dir === "across" ? "down" : "across";
    if (c && c[other] !== null) { dir = other; render(); }
  }

  function gotoEntry(ei) {
    const e = current.entries[ei];
    dir = e.dir;
    select(firstEmptyIn(e), e.dir);
  }

  function stepEntry(delta) {
    const e = activeEntry();
    const idx = e ? current.order.indexOf(e.ei) : -1;
    const n = current.order.length;
    gotoEntry(current.order[(idx + delta + n) % n]);
  }

  function moveArrow(dr, dc) {
    const axis = dr === 0 ? "across" : "down";
    const c = cellAt(pos);
    if (axis !== dir && c && c[axis] !== null) { dir = axis; render(); return; }
    let r = c.r + dr, col = c.c + dc;
    while (r >= 0 && r < current.rows && col >= 0 && col < current.cols) {
      const gi = r * current.cols + col;
      if (cellAt(gi)) { select(gi, axis); return; }
      r += dr; col += dc;
    }
  }

  /* ------------------------------------------------------------------ *
   * Editing
   * ------------------------------------------------------------------ */

  function solvedLocked() { return board.classList.contains("solved"); }

  function startClock() { S.started = true; }

  function typeLetter(ch) {
    if (solvedLocked()) return;
    const c = cellAt(pos);
    if (!c) return;
    startClock();
    // Words through this square that weren't already correct, so we only
    // celebrate the keystroke that completes one.
    const through = entriesThrough(pos).filter((en) => !entryCorrect(en));
    if (!S.revealed.has(c.li)) {
      S.letters[c.li] = ch;
      S.wrong.delete(c.li);
    }
    const e = activeEntry();
    if (e) {
      const k = e.cells.indexOf(pos);
      if (k < e.cells.length - 1) pos = e.cells[k + 1];
    }
    afterEdit();
    if (solvedLocked()) wave();
    else through.filter(entryCorrect).forEach(ripple);
  }

  /* ------------------------------------------------------------------ *
   * Celebrations
   * ------------------------------------------------------------------ */

  function entriesThrough(gi) {
    const c = cellAt(gi);
    if (!c) return [];
    return ["across", "down"].filter((d) => c[d] !== null).map((d) => current.entries[c[d]]);
  }

  function entryCorrect(en) {
    return en.cells.every((gi) => S.letters[cellAt(gi).li] === cellAt(gi).ans);
  }

  function animateCell(gi, cls, delayMs) {
    const d = cellEls[gi];
    if (!d) return;
    d.classList.remove("ripple", "wave");
    void d.offsetWidth; // restart the animation if it's already running
    d.style.setProperty("--fx-delay", `${delayMs}ms`);
    d.classList.add(cls);
  }

  // A pulse that travels along the word, first letter to last.
  function ripple(en) {
    if (REDUCED_MOTION && REDUCED_MOTION.matches) return;
    en.cells.forEach((gi, k) => animateCell(gi, "ripple", k * 60));
  }

  // On a solve, a wave rolls diagonally across the whole grid.
  function wave() {
    if (REDUCED_MOTION && REDUCED_MOTION.matches) return;
    current.letterCells.forEach((gi) => {
      const c = cellAt(gi);
      animateCell(gi, "wave", (c.r + c.c) * 35);
    });
  }

  board.addEventListener("animationend", (ev) => {
    const d = ev.target;
    if (d.classList && (ev.animationName === "cell-ripple" || ev.animationName === "cell-wave")) {
      d.classList.remove("ripple", "wave");
    }
  });

  function backspace() {
    if (solvedLocked()) return;
    const c = cellAt(pos);
    if (!c) return;
    if (S.letters[c.li] && !S.revealed.has(c.li)) {
      S.letters[c.li] = "";
      S.wrong.delete(c.li);
    } else {
      const e = activeEntry();
      const k = e ? e.cells.indexOf(pos) : 0;
      if (e && k > 0) {
        pos = e.cells[k - 1];
        const pc = cellAt(pos);
        if (!S.revealed.has(pc.li)) { S.letters[pc.li] = ""; S.wrong.delete(pc.li); }
      }
    }
    afterEdit();
  }

  function deleteCell() {
    if (solvedLocked()) return;
    const c = cellAt(pos);
    if (c && !S.revealed.has(c.li)) { S.letters[c.li] = ""; S.wrong.delete(c.li); }
    afterEdit();
  }

  function afterEdit() {
    hideBanner();
    render();
    renderPicker();
    checkCompletion();
    scheduleSave();
  }

  function isSolved(m = current, s = S) {
    return m.letterCells.every((gi, li) => s.letters[li] === m.cells[gi].ans);
  }

  function checkCompletion() {
    if (S.letters.some((x) => !x)) return;
    if (isSolved()) showSolved(true);
    else showBanner("The grid is full but something isn't right yet. Try Check → Puzzle.", "warn");
  }

  function showSolved(fresh) {
    board.classList.add("solved");
    S.wrong.clear();
    const reveals = S.revealed.size;
    const msg = `${fresh ? "Solved!" : "Already solved."} Time ${fmtTime(S.time)}` +
      (reveals ? ` with ${reveals} revealed letter${reveals === 1 ? "" : "s"}.` : ", no reveals. Nicely done.");
    showBanner(msg, "win");
    renderPicker();
  }

  function cellsFor(scope) {
    if (scope === "cell") return cellAt(pos) ? [pos] : [];
    if (scope === "word") return activeEntry() ? activeEntry().cells : [];
    return current.letterCells;
  }

  function check(scope) {
    let wrong = 0, blank = 0;
    for (const gi of cellsFor(scope)) {
      const c = cellAt(gi);
      const v = S.letters[c.li];
      if (!v) { blank++; continue; }
      if (v !== c.ans) { S.wrong.add(c.li); wrong++; }
    }
    render();
    if (scope === "all") {
      if (wrong) showBanner(`${wrong} letter${wrong === 1 ? " is" : "s are"} wrong.`, "warn");
      else if (blank) showBanner(`Everything so far is correct. ${blank} square${blank === 1 ? "" : "s"} to go.`);
      else checkCompletion();
    } else if (!wrong) {
      showBanner(blank ? "No mistakes so far." : "Correct.");
    }
  }

  function reveal(scope) {
    if (solvedLocked()) return;
    startClock();
    for (const gi of cellsFor(scope)) {
      const c = cellAt(gi);
      if (S.letters[c.li] !== c.ans) {
        S.letters[c.li] = c.ans;
        S.revealed.add(c.li);
      }
      S.wrong.delete(c.li);
    }
    afterEdit();
  }

  function clearPuzzle() {
    states.set(current.id, blankState(current));
    openPuzzle(current.id);
  }

  /* ------------------------------------------------------------------ *
   * Timer
   * ------------------------------------------------------------------ */

  function fmtTime(t) {
    t = Math.floor(t);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  function renderTimer() { $("#timer").textContent = fmtTime(S ? S.time : 0); }

  let ticks = 0;
  setInterval(() => {
    if (!S || solvedLocked() || document.visibilityState !== "visible") return;
    if (!S.started && S.time === 0) return;
    if (document.querySelector("dialog[open]")) return;
    S.time = Math.min(MAX_TIME, S.time + 1);
    renderTimer();
    if (++ticks % 10 === 0) scheduleSave();
  }, 1000);

  /* ------------------------------------------------------------------ *
   * Banner
   * ------------------------------------------------------------------ */

  let bannerTimer = null;
  function showBanner(text, kind) {
    clearTimeout(bannerTimer);
    banner.textContent = text;
    banner.className = "banner" + (kind ? " " + kind : "");
    banner.hidden = false;
    if (kind !== "win") bannerTimer = setTimeout(hideBanner, 5000);
  }
  function hideBanner() {
    if (board.classList.contains("solved")) return;
    clearTimeout(bannerTimer);
    banner.hidden = true;
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  board.addEventListener("click", (ev) => {
    const d = ev.target.closest(".cell.letter");
    if (!d) return;
    const gi = Number(d.dataset.gi);
    if (gi === pos) toggleDir();
    else select(gi);
    board.focus({ preventScroll: true });
  });

  $("#clues-across").parentElement.parentElement.addEventListener("click", (ev) => {
    const li = ev.target.closest("li[data-ei]");
    if (li) gotoEntry(Number(li.dataset.ei));
  });
  $(".clues").addEventListener("keydown", (ev) => {
    const li = ev.target.closest("li[data-ei]");
    if (li && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      gotoEntry(Number(li.dataset.ei));
      board.focus({ preventScroll: true });
    }
  });

  $("#picker").addEventListener("click", (ev) => {
    const b = ev.target.closest(".chip");
    if (b && b.dataset.id !== current.id) { saveNow(); openPuzzle(b.dataset.id); }
  });

  document.addEventListener("keydown", (ev) => {
    if (document.querySelector("dialog[open]")) return;
    const t = ev.target;
    if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (t && t.closest && t.closest(".clues, .picker, .menu, .top") && (ev.key === "Enter" || ev.key === " " || ev.key === "Tab")) return;

    const k = ev.key;
    if (k === "Escape") { closeMenus(); return; }
    if (/^[a-zA-Z]$/.test(k)) { ev.preventDefault(); closeMenus(); typeLetter(k.toUpperCase()); return; }
    switch (k) {
      case "Backspace": ev.preventDefault(); backspace(); break;
      case "Delete": ev.preventDefault(); deleteCell(); break;
      case "ArrowLeft": ev.preventDefault(); moveArrow(0, -1); break;
      case "ArrowRight": ev.preventDefault(); moveArrow(0, 1); break;
      case "ArrowUp": ev.preventDefault(); moveArrow(-1, 0); break;
      case "ArrowDown": ev.preventDefault(); moveArrow(1, 0); break;
      case " ": ev.preventDefault(); toggleDir(); break;
      case "Enter": ev.preventDefault(); stepEntry(ev.shiftKey ? -1 : 1); break;
      case "Tab":
        if (t === board || t === document.body) { ev.preventDefault(); stepEntry(ev.shiftKey ? -1 : 1); }
        break;
      default: break;
    }
  });

  // Menus and action buttons
  function closeMenus() {
    document.querySelectorAll(".menu-list").forEach((m) => { m.hidden = true; });
    document.querySelectorAll("[data-menu]").forEach((b) => b.setAttribute("aria-expanded", "false"));
  }
  document.addEventListener("click", (ev) => {
    const menuBtn = ev.target.closest("[data-menu]");
    if (menuBtn) {
      const list = $("#menu-" + menuBtn.dataset.menu);
      const open = list.hidden;
      closeMenus();
      list.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
      return;
    }
    if (!ev.target.closest(".menu")) closeMenus();

    const act = ev.target.closest("[data-action]");
    if (!act) return;
    closeMenus();
    const a = act.dataset.action;
    if (a === "check-cell") check("cell");
    else if (a === "check-word") check("word");
    else if (a === "check-all") check("all");
    else if (a === "reveal-cell") reveal("cell");
    else if (a === "reveal-word") reveal("word");
    else if (a === "reveal-all") confirmThen("Reveal every answer in this puzzle?", () => reveal("all"));
    else if (a === "clear") confirmThen("Clear all letters and reset the timer for this puzzle?", clearPuzzle);
    else if (a === "prev") stepEntry(-1);
    else if (a === "next") stepEntry(1);
    if (a !== "clear" && a !== "reveal-all") board.focus({ preventScroll: true });
  });

  // On-screen keyboard (shown on touch devices)
  (function buildKeyboard() {
    const kb = $("#keyboard");
    const rows = ["QWERTYUIOP", "ASDFGHJKL", "⇄ZXCVBNM⌫"];
    for (const row of rows) {
      const r = el("div", "kb-row");
      for (const ch of row) {
        const b = el("button", "key" + (ch === "⌫" || ch === "⇄" ? " wide" : ""), ch);
        b.type = "button";
        b.tabIndex = -1;
        b.dataset.key = ch;
        if (ch === "⌫") b.setAttribute("aria-label", "Backspace");
        if (ch === "⇄") b.setAttribute("aria-label", "Switch direction");
        r.append(b);
      }
      kb.append(r);
    }
    kb.addEventListener("click", (ev) => {
      const b = ev.target.closest(".key");
      if (!b) return;
      const k = b.dataset.key;
      if (k === "⌫") backspace();
      else if (k === "⇄") toggleDir();
      else typeLetter(k);
    });
  })();

  // Confirm dialog
  function confirmThen(text, fn) {
    const dlg = $("#dlg-confirm");
    $("#confirm-text").textContent = text;
    dlg.returnValue = "";
    dlg.addEventListener("close", function onClose() {
      dlg.removeEventListener("close", onClose);
      if (dlg.returnValue === "ok") fn();
    });
    dlg.showModal();
  }

  // Save key dialog
  $("#btn-save").addEventListener("click", () => {
    saveNow();
    const key = encodeKey();
    const ta = $("#save-key");
    ta.value = key;
    const n = [...states.values()].filter(hasProgress).length;
    $("#save-status").className = "hint";
    $("#save-status").textContent = n ? `Includes ${n} puzzle${n === 1 ? "" : "s"} in progress · ${key.length} characters` : "No progress yet. Start a puzzle, then save.";
    $("#dlg-save").showModal();
    ta.focus();
    ta.select();
  });

  $("#btn-copy").addEventListener("click", async () => {
    const ta = $("#save-key");
    const status = $("#save-status");
    try {
      await navigator.clipboard.writeText(ta.value);
      status.className = "hint ok";
      status.textContent = "Copied to clipboard.";
    } catch (_) {
      ta.focus();
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (__) { ok = false; }
      status.className = ok ? "hint ok" : "hint";
      status.textContent = ok ? "Copied to clipboard." : "Select the key and copy it manually.";
    }
  });

  // Restore dialog
  $("#btn-restore").addEventListener("click", () => {
    $("#restore-key").value = "";
    $("#restore-error").textContent = "";
    $("#dlg-restore").showModal();
    $("#restore-key").focus();
  });

  $("#btn-do-restore").addEventListener("click", () => {
    const res = decodeKey($("#restore-key").value);
    if (!res.ok) { $("#restore-error").textContent = res.error; return; }
    for (const [id, s] of res.states) { s.started = s.time > 0; states.set(id, s); }
    $("#dlg-restore").close();
    openPuzzle(res.active);
    saveNow();
    const n = res.states.size;
    showBanner(`Restored ${n} puzzle${n === 1 ? "" : "s"}${res.skipped ? ` (${res.skipped} skipped)` : ""}.`);
  });
  $("#restore-key").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); $("#btn-do-restore").click(); }
  });

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });
  window.addEventListener("pagehide", saveNow);

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function defaultPuzzleId() {
    if (MODELS.has(DEFAULT_PUZZLE)) return DEFAULT_PUZZLE;
    const general = PUZZLES.find((p) => p.category === CATEGORY_ORDER[0]);
    return (general || PUZZLES[0]).id;
  }

  if (!PUZZLES.length) {
    $("#puzzle-title").textContent = "No puzzles found";
    return;
  }

  const local = loadLocal();
  if (local) for (const [id, s] of local.states) states.set(id, s);
  for (const s of states.values()) if (s.time > 0) s.started = true;

  const fromHash = decodeURIComponent(location.hash.slice(1));
  openPuzzle(MODELS.has(fromHash) ? fromHash : local ? local.active : defaultPuzzleId());

  window.addEventListener("hashchange", () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (MODELS.has(id) && id !== current.id) { saveNow(); openPuzzle(id); }
  });

  // Exposed for tests / debugging only.
  window.__crossword = { encodeKey, decodeKey };
})();
