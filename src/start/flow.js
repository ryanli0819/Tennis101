// =====================================================================
// START FLOW — what you see when the game opens. Owner: Start Page Builder (agents/start-page-builder/).
//   1. Welcome      → Play
//   2. Match        → best of 3 or 5, tiebreak to 7 or 10, controls (CONTROL_SCHEMES, once loaded)
//   3. Court        → grass, red clay or hard
//   4. Locker room  → pick your pro (Locker Room Designer's module), who serves first → Walk on court
// Ends by calling window.startMatch({ bestOf, tbTo, surface, playerId, firstServer }), plus `controls` when schemes exist.
// =====================================================================
(function () {
  const css = `
  .sf { position: fixed; inset: 0; z-index: 10; overflow-y: auto; background: radial-gradient(ellipse at 50% 120%, #14254a 0%, var(--night) 60%);
        padding: 24px max(16px, env(safe-area-inset-right, 0px)) 32px max(16px, env(safe-area-inset-left, 0px)); }
  .sf-in { max-width: 760px; margin: 0 auto; display: grid; gap: 20px; }
  .sf-steps { display: flex; gap: 6px; font: 8px var(--f-pix); letter-spacing: .08em; color: var(--muted); }
  .sf-steps span { flex: 1; border-top: 3px solid var(--line); padding-top: 6px; }
  .sf-steps span.on { border-color: var(--ball); color: var(--ink); }
  .sf h2 { margin: 0; font: 700 clamp(30px, 6vw, 46px)/1 var(--f-name); }
  .sf p.sub { margin: 6px 0 0; color: var(--muted); font-size: 17px; }
  .sf-opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  .sf-opt { text-align: left; font: inherit; color: var(--ink); background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px;
            padding: 16px; cursor: pointer; display: grid; gap: 6px; }
  .sf-opt:hover { border-color: #3c5180; }
  .sf-opt[aria-checked="true"] { border-color: var(--ball); box-shadow: inset 0 0 0 1px var(--ball); }
  .sf-opt:focus-visible, .sf .btn:focus-visible { outline: 2px solid var(--ball); outline-offset: 2px; }
  .sf-opt b { font: 700 26px/1 var(--f-name); }
  .sf-opt span { color: var(--muted); font-size: 15px; }
  .sf-swatch { height: 46px; border-radius: 5px; image-rendering: pixelated; }
  .sf-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
  .sf-mini { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; color: var(--muted); font-size: 14px; }
  .sf-mini button { font: 600 15px var(--f-name); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 5px; padding: 6px 12px; cursor: pointer; }
  .sf-mini button[aria-pressed="true"] { border-color: var(--ball); color: var(--ball); }
  .sf .btn.big { font-size: 20px; padding: 12px 22px; }
  .sf-welcome { min-height: calc(100vh - 56px); display: grid; place-content: center; text-align: center; gap: 22px; }
  .sf-title { font: 400 clamp(46px, 12vw, 120px)/1 var(--f-pix); letter-spacing: .02em; margin: 0; color: var(--ink); text-shadow: 0 6px 0 #14254a; }
  .sf-title em { font-style: normal; color: var(--ball); }
  .sf-tag { color: var(--muted); font-size: 19px; margin: 0; }
  .sf-links { font-size: 14px; color: var(--muted); }
  .sf-links a { color: var(--muted); }
  .sf-exit { position: fixed; top: calc(12px + env(safe-area-inset-top, 0px)); right: max(16px, env(safe-area-inset-right, 0px)); z-index: 11;
             font: 600 15px var(--f-name); letter-spacing: .05em; text-transform: uppercase; color: var(--ink); background: var(--panel);
             border: 1px solid var(--line); border-radius: 5px; padding: 7px 12px; cursor: pointer; }
  .sf-exit:focus-visible { outline: 2px solid var(--ball); outline-offset: 2px; }
  .sf-lockerdoor { display: grid; place-items: center; gap: 14px; padding: 34px 16px; background: var(--panel); border: 1px dashed var(--line); border-radius: 10px; text-align: center; }
  .sf-logo { display: block; margin: 0 auto; image-rendering: pixelated; max-width: 100%; }
  .sf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .sf-enter > :not(.sf-exit) { animation: sf-enter .24s ease-out both; }   /* not the fixed Exit button: a transform would move it */
  @keyframes sf-enter { from { opacity: 0; transform: translateX(var(--sf-dx, 0px)); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .sf-enter > :not(.sf-exit) { animation: none; } }`;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  const SURFACES = [
    { id: "grass", name: "Grass", say: "Fast and low. The ball skids; first-strike tennis.", colors: ["#5f9443", "#4f7d3a"] },
    { id: "clay",  name: "Red clay", say: "Slow and high. Long rallies; you can slide.", colors: ["#c2603d", "#b5583a"] },
    { id: "hard",  name: "Hard", say: "Medium pace, true bounce. The all-rounder.", colors: ["#2b5c90", "#3f74a8"] },
  ];
  const choice = { bestOf: 3, tbTo: 7, surface: "hard", playerId: "sinner", firstServer: "0" };
  let root, live, step = 0, onResume = null;                  // onResume: set when a match is under way ("Back to match")
  const STEPS = ["MATCH", "COURT", "LOCKER ROOM"];

  // PIXEL TITLE: "TENNIS101" in a 5×7 bitmap font, drawn at a whole-number scale so every pixel stays square.
  const GLYPHS = {
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    I: ["111", "010", "010", "010", "010", "010", "111"],
    S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    1: ["010", "110", "010", "010", "010", "010", "111"],
    0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  };
  const BALL = ["01110", "11011", "10001", "11011", "01110"];   // felt ring with a seam gap, tossed up after "101"
  function drawLogo(cv) {
    const word = "TENNIS101", gap = 1, css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ink").trim() || "#eef3fb", ball = css.getPropertyValue("--ball").trim() || "#d8ee4c";
    const text = [...word].reduce((w, ch) => w + GLYPHS[ch][0].length + gap, -gap);
    const cols = text + 1 + 5, rows = 2 + 7 + 1;                        // ball to the right, raised 2 rows; 1 row of shadow
    const avail = Math.min(root.clientWidth - 32, 640);
    const s = Math.max(2, Math.floor(avail / cols));
    cv.width = cols * s; cv.height = rows * s;
    cv.style.width = cv.width + "px";
    const g = cv.getContext("2d");
    const glyph = (rowsOf, x0, y0, color) => { g.fillStyle = color; rowsOf.forEach((r, y) => [...r].forEach((c, x) => c === "1" && g.fillRect((x0 + x) * s, (y0 + y) * s, s, s))); };
    let x = 0;
    [...word].forEach((ch, i) => {
      const color = i >= 6 ? ball : ink;                                  // "101" in ball-yellow, like the old title
      glyph(GLYPHS[ch], x, 3, "#14254a");                                 // drop shadow one pixel down
      glyph(GLYPHS[ch], x, 2, color);
      x += GLYPHS[ch][0].length + gap;
    });
    glyph(BALL, text + 1, 1, "#14254a");
    glyph(BALL, text + 1, 0, ball);
  }

  // Arrow keys move through a radio group (one tab stop per group), like native radio buttons.
  function radio(group, opts, key, onPick) {
    group.setAttribute("role", "radiogroup");
    group.innerHTML = "";
    const pick = b => {
      const o = opts[[...group.children].indexOf(b)];
      choice[key] = o.value;
      group.querySelectorAll(".sf-opt").forEach(x => { x.setAttribute("aria-checked", String(x === b)); x.tabIndex = x === b ? 0 : -1; });
      onPick && onPick();
    };
    for (const o of opts) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "sf-opt"; b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(choice[key] === o.value));
      b.tabIndex = choice[key] === o.value ? 0 : -1;
      b.innerHTML = o.html;
      b.onclick = () => pick(b);
      group.appendChild(b);
    }
    group.onkeydown = e => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const all = [...group.children], i = all.indexOf(document.activeElement);
      const b = all[(i + d + all.length) % all.length];
      pick(b); b.focus();
    };
  }
  // Small pressed-button groups (tiebreak, first server, controls).
  function toggles(v, attr, key, parse = x => x) {
    v.querySelectorAll(`[${attr}]`).forEach(b => {
      const val = () => parse(b.getAttribute(attr));
      b.setAttribute("aria-pressed", String(val() === choice[key]));
      b.onclick = () => { choice[key] = val(); v.querySelectorAll(`[${attr}]`).forEach(x => x.setAttribute("aria-pressed", String(x === b))); };
    });
  }
  // Controls Designer's schemes (src/controls/schemes.js). Until that is on main the row just says what works today.
  function controlsRow() {
    const list = Array.isArray(window.CONTROL_SCHEMES) ? window.CONTROL_SCHEMES : null;
    if (!list || !list.length) return `<div class="sf-mini">Controls: W A S D to move (drag on the court on touch) · arrows aim the serve</div>`;
    if (!list.some(s => s.id === choice.controls)) {
      let cur = null; try { cur = window.getScheme && window.getScheme(); } catch (e) {}
      choice.controls = (cur && cur.id) || list[0].id;
    }
    return `<div class="sf-mini" role="group" aria-label="Controls">Controls: ${list.map(s => `<button type="button" data-ctl="${s.id}">${s.label}</button>`).join("")}</div>`;
  }
  const steps = n => `<div class="sf-steps" aria-hidden="true">${STEPS.map((s, i) => `<span class="${i <= n ? "on" : ""}">${i + 1} · ${s}</span>`).join("")}</div>`;
  const nav = (backLabel, nextLabel) => `<div class="sf-row"><button class="btn" type="button" data-go="back">← ${backLabel}</button><button class="btn primary big" type="button" data-go="next">${nextLabel} →</button></div>`;

  function show(n) {
    const v = root.querySelector(".sf-in");
    v.style.setProperty("--sf-dx", n > step ? "18px" : n < step ? "-18px" : "0px");   // forward slides in from the right, back from the left
    step = n;
    if (n === 0) {
      v.innerHTML = `<div class="sf-welcome">
        <h1 class="sf-title"><span class="sf-sr">Tennis101</span><canvas class="sf-logo" id="sfLogo" aria-hidden="true"></canvas></h1>
        <p class="sf-tag">Play inside a real pro's body.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${onResume ? `<button class="btn primary big" type="button" id="sfResume">Back to match →</button>` : ""}<button class="btn ${onResume ? "" : "primary "}big" type="button" data-go="next">${onResume ? "New match" : "Play →"}</button>${window.Guide ? `<button class="btn big" type="button" id="sfHelp">? How to play</button>` : ""}</div>
        <p class="sf-links"><a href="presentation/">How it was built</a> · <a href="agents/dashboard.html">Agent Control Room</a></p></div>`;
      drawLogo(v.querySelector("#sfLogo"));
      const h = v.querySelector("#sfHelp"); if (h) h.onclick = () => window.Guide.open();
    } else if (n === 1) {
      v.innerHTML = `${steps(0)}<div><h2>Choose your match</h2><p class="sub">How long do you want to play?</p></div>
        <div class="sf-opts" id="sfLen" aria-label="Match length"></div>
        <div class="sf-mini" role="group" aria-label="Tiebreak">Tiebreak at 6–6, first to <button type="button" data-tb="7">7</button><button type="button" data-tb="10">10</button> points (win by 2)</div>
        ${controlsRow()}
        ${nav("Back", "Choose court")}`;
      radio(v.querySelector("#sfLen"), [
        { value: 3, html: "<b>Best of 3 sets</b><span>First to win 2 sets. A standard match.</span>" },
        { value: 5, html: "<b>Best of 5 sets</b><span>First to win 3 sets. Grand Slam length; stamina matters.</span>" }], "bestOf");
      toggles(v, "data-tb", "tbTo", Number);
      toggles(v, "data-ctl", "controls");
    } else if (n === 2) {
      v.innerHTML = `${steps(1)}<div><h2>Choose your court</h2><p class="sub">The surface changes how fast and how high the ball bounces.</p></div>
        <div class="sf-opts" id="sfCourt" aria-label="Court surface"></div>${nav("Match", "Locker room")}`;
      radio(v.querySelector("#sfCourt"), SURFACES.map(s => ({ value: s.id,
        html: `<div class="sf-swatch" style="background:repeating-linear-gradient(90deg,${s.colors[0]} 0 14px,${s.colors[1]} 14px 28px)"></div><b>${s.name}</b><span>${s.say}</span>` })), "surface");
    } else if (n === 3) {
      v.innerHTML = `${steps(2)}<div><h2>Locker room</h2><p class="sub">Your pro is waiting. Pick who you'll play as.</p></div>
        <div class="sf-lockerdoor"><span class="sf-tag">Two pros are getting ready.</span><button class="btn primary big" type="button" id="sfEnter">Enter the locker room</button></div>
        <div class="sf-row"><button class="btn" type="button" data-go="back">← Court</button></div>`;
      v.querySelector("#sfEnter").onclick = () => show(4);
    } else if (n === 4) {
      v.innerHTML = `${steps(2)}<div><h2>Locker room</h2><p class="sub">Body and skill points decide how each pro moves and hits. 10 is average; every point above it adds the same step.</p></div>
        <div id="sfLocker"></div>
        <div class="sf-mini" role="group" aria-label="First serve">First serve: <button type="button" data-fs="0">You</button><button type="button" data-fs="1">Opponent</button><button type="button" data-fs="r">Coin toss</button></div>
        ${nav("Court", "Walk on court")}`;
      window.Lockerroom.render(v.querySelector("#sfLocker"), { roster: window.ROSTER, bodyStats: window.bodyStats, selected: choice.playerId, onSelect: id => (choice.playerId = id) });
      toggles(v, "data-fs", "firstServer");
    }
    v.classList.remove("sf-enter"); void v.offsetWidth; v.classList.add("sf-enter");   // restart the step transition (off with reduced motion, in CSS)
    live.textContent = n === 0 ? "Welcome" : `Step ${Math.min(n, 3)} of 3: ${v.querySelector("h2").textContent}`;
    // EXIT only on side screens (Ryan's rule): the locker room has ✕ Exit back to the welcome page.
    // The welcome page, the match setup steps (they have ← Back) and the match itself have no exit button.
    if (n >= 3) {
      const x = document.createElement("button");
      x.type = "button"; x.className = "sf-exit"; x.textContent = "✕ Exit";
      x.setAttribute("aria-label", "Leave the locker room, back to the welcome page");
      x.onclick = () => show(0);
      v.appendChild(x);
    }
    const r = v.querySelector("#sfResume"); if (r) r.onclick = resume;
    v.querySelectorAll("[data-go]").forEach(b => (b.onclick = () => go(b.dataset.go)));
    const first = v.querySelector(n === 0 ? "#sfResume, [data-go=next]" : ".sf-opt[tabindex='0'], #sfEnter, .lr-card");
    first && first.focus({ preventScroll: true });
    root.scrollTop = 0;
  }
  function go(dir) {
    if (dir === "back") return show(step === 4 ? 2 : step - 1);
    if (step === 4) {
      const { controls, ...match } = choice;               // controls only once Controls Designer's schemes are loaded
      close(); window.startMatch(window.CONTROL_SCHEMES && controls ? { ...match, controls } : match); return;
    }
    show(step + 1);
  }
  function resume() { const fn = onResume; close(); fn && fn(); }
  // open(step, resumeFn): step 0 = welcome, 1 = match length. resumeFn is given when a match is under way.
  function open(n = 0, resumeFn = null) {
    if (!root) {
      root = document.createElement("div"); root.className = "sf"; root.id = "startFlow";
      root.innerHTML = `<div class="sf-in"></div><p class="sf-sr" aria-live="polite"></p>`;
      live = root.querySelector("[aria-live]");
      document.body.appendChild(root);
      addEventListener("resize", () => { const c = isOpen() && root.querySelector("#sfLogo"); c && drawLogo(c); });
      root.addEventListener("keydown", e => { if (e.key === "Escape" && step >= 3) { e.preventDefault(); show(0); } });   // Esc = the locker room's exit
    }
    onResume = resumeFn;
    root.hidden = false; show(n);
  }
  function close() { root.hidden = true; }
  const isOpen = () => !!root && !root.hidden;

  window.StartFlow = { open, close, isOpen, SURFACES };
})();
