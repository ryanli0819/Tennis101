// =====================================================================
// START FLOW — what you see when the game opens. Owner: Start Page Builder (agents/start-page-builder/).
//   1. Welcome      → Play
//   2. Match        → best of 3 or 5, tiebreak to 7 or 10
//   3. Court        → grass, red clay or hard
//   4. Locker room  → pick your pro (Locker Room Designer's module), who serves first → Walk on court
// Ends by calling window.startMatch({ bestOf, tbTo, surface, playerId, firstServer }).
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
  .sf-lockerdoor { display: grid; place-items: center; gap: 14px; padding: 34px 16px; background: var(--panel); border: 1px dashed var(--line); border-radius: 10px; text-align: center; }`;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  const SURFACES = [
    { id: "grass", name: "Grass", say: "Fast and low. The ball skids; first-strike tennis.", colors: ["#5f9443", "#4f7d3a"] },
    { id: "clay",  name: "Red clay", say: "Slow and high. Long rallies; you can slide.", colors: ["#c2603d", "#b5583a"] },
    { id: "hard",  name: "Hard", say: "Medium pace, true bounce. The all-rounder.", colors: ["#2b5c90", "#3f74a8"] },
  ];
  const choice = { bestOf: 3, tbTo: 7, surface: "hard", playerId: "sinner", firstServer: "0" };
  let root, step = 0, onResume = null;                   // onResume: set when a match is under way ("Back to match")
  const STEPS = ["MATCH", "COURT", "LOCKER ROOM"];

  function radio(group, opts, key, onPick) {
    group.setAttribute("role", "radiogroup");
    group.innerHTML = "";
    for (const o of opts) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "sf-opt"; b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(choice[key] === o.value));
      b.innerHTML = o.html;
      b.onclick = () => { choice[key] = o.value; group.querySelectorAll(".sf-opt").forEach(x => x.setAttribute("aria-checked", String(x === b))); onPick && onPick(); };
      group.appendChild(b);
    }
  }
  const steps = n => `<div class="sf-steps" aria-hidden="true">${STEPS.map((s, i) => `<span class="${i <= n ? "on" : ""}">${i + 1} · ${s}</span>`).join("")}</div>`;
  const nav = (backLabel, nextLabel) => `<div class="sf-row"><button class="btn" type="button" data-go="back">← ${backLabel}</button><button class="btn primary big" type="button" data-go="next">${nextLabel} →</button></div>`;

  function show(n) {
    step = n;
    const v = root.querySelector(".sf-in");
    if (n === 0) {
      v.innerHTML = `<div class="sf-welcome">
        <h1 class="sf-title">Tennis<em>101</em></h1>
        <p class="sf-tag">Play inside a real pro's body.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${onResume ? `<button class="btn primary big" type="button" id="sfResume">Back to match →</button>` : ""}<button class="btn ${onResume ? "" : "primary "}big" type="button" data-go="next">${onResume ? "New match" : "Play →"}</button></div>
        <p class="sf-links"><a href="presentation/">How it was built</a> · <a href="agents/dashboard.html">Agent Control Room</a></p></div>`;
    } else if (n === 1) {
      v.innerHTML = `${steps(0)}<div><h2>Choose your match</h2><p class="sub">How long do you want to play?</p></div>
        <div class="sf-opts" id="sfLen"></div>
        <div class="sf-mini">Tiebreak at 6–6, first to <button type="button" data-tb="7">7</button><button type="button" data-tb="10">10</button> points (win by 2)</div>
        ${nav("Back", "Choose court")}`;
      radio(v.querySelector("#sfLen"), [
        { value: 3, html: "<b>Best of 3 sets</b><span>First to win 2 sets. A standard match.</span>" },
        { value: 5, html: "<b>Best of 5 sets</b><span>First to win 3 sets. Grand Slam length; stamina matters.</span>" }], "bestOf");
      v.querySelectorAll("[data-tb]").forEach(b => {
        b.setAttribute("aria-pressed", String(+b.dataset.tb === choice.tbTo));
        b.onclick = () => { choice.tbTo = +b.dataset.tb; v.querySelectorAll("[data-tb]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); };
      });
    } else if (n === 2) {
      v.innerHTML = `${steps(1)}<div><h2>Choose your court</h2><p class="sub">The surface changes how fast and how high the ball bounces.</p></div>
        <div class="sf-opts" id="sfCourt"></div>${nav("Match", "Locker room")}`;
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
        <div class="sf-mini">First serve: <button type="button" data-fs="0">You</button><button type="button" data-fs="1">Opponent</button><button type="button" data-fs="r">Coin toss</button></div>
        ${nav("Court", "Walk on court")}`;
      window.Lockerroom.render(v.querySelector("#sfLocker"), { roster: window.ROSTER, bodyStats: window.bodyStats, selected: choice.playerId, onSelect: id => (choice.playerId = id) });
      v.querySelectorAll("[data-fs]").forEach(b => {
        b.setAttribute("aria-pressed", String(b.dataset.fs === choice.firstServer));
        b.onclick = () => { choice.firstServer = b.dataset.fs; v.querySelectorAll("[data-fs]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); };
      });
    }
    // EXIT on every screen: from a setup step back to the welcome page; from the welcome page back to the match (if one is on)
    if (n > 0 || onResume) {
      const x = document.createElement("button");
      x.type = "button"; x.className = "sf-exit";
      x.textContent = n > 0 ? "✕ Exit" : "✕ Close";
      x.setAttribute("aria-label", n > 0 ? "Exit setup, back to the welcome page" : "Close the menu, back to the match");
      x.onclick = () => (n > 0 ? show(0) : resume());
      v.appendChild(x);
    }
    const r = v.querySelector("#sfResume"); if (r) r.onclick = resume;
    v.querySelectorAll("[data-go]").forEach(b => (b.onclick = () => go(b.dataset.go)));
    const first = v.querySelector(n === 0 ? "#sfResume, [data-go=next]" : ".sf-opt, #sfEnter, .lr-card");
    first && first.focus({ preventScroll: true });
    root.scrollTop = 0;
  }
  function go(dir) {
    if (dir === "back") return show(step === 4 ? 2 : step - 1);
    if (step === 4) { close(); window.startMatch({ ...choice }); return; }
    show(step + 1);
  }
  function resume() { const fn = onResume; close(); fn && fn(); }
  // open(step, resumeFn): step 0 = welcome, 1 = match length. resumeFn is given when a match is under way.
  function open(n = 0, resumeFn = null) {
    if (!root) {
      root = document.createElement("div"); root.className = "sf"; root.id = "startFlow";
      root.innerHTML = `<div class="sf-in"></div>`;
      document.body.appendChild(root);
      root.addEventListener("keydown", e => { if (e.key === "Escape") { e.preventDefault(); step > 0 ? show(0) : onResume && resume(); } });
    }
    onResume = resumeFn;
    root.hidden = false; show(n);
  }
  function close() { root.hidden = true; }
  const isOpen = () => !!root && !root.hidden;

  window.StartFlow = { open, close, isOpen, SURFACES };
})();
