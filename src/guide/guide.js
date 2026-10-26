// =====================================================================
// HOW TO PLAY — the in-game guide. Owner: Guide Writer (agents/guide-writer/).
//
// Keys come from CONTROL_SCHEMES (Controls Designer) and skills from SKILLS (Skills Coach),
// so the guide never goes stale. Until src/controls/schemes.js lands on main, FALLBACK_SCHEMES
// mirrors userInput() and the keydown handler in index.html.
// Opens from the "?" button (match screen and start page). Esc closes it.
// =====================================================================
(function () {
  const FALLBACK_SCHEMES = [
    { id: "keyboard", label: "Keyboard", devices: ["keyboard"], bindings: [
      { action: "moveForward", keys: ["W", "↑"], text: "Move toward the net" },
      { action: "moveBack",    keys: ["S", "↓"], text: "Move back" },
      { action: "moveLeft",    keys: ["A", "←"], text: "Move left" },
      { action: "moveRight",   keys: ["D", "→"], text: "Move right" },
      { action: "splitStep",   keys: ["Shift"],  text: "Split step" },
      { action: "playPoint",   keys: ["Space"],  text: "Play the point" },
      { action: "undo",        keys: ["Z"],      text: "Undo the last point" },
    ] },
    { id: "touch", label: "Touch", devices: ["touch", "mouse"], bindings: [
      { action: "move",      keys: ["Drag"],       text: "Drag on the court to move" },
      { action: "splitStep", keys: ["Split step"], text: "Tap to split step" },
      { action: "playPoint", keys: ["Play point"], text: "Tap to play the point" },
    ] },
  ];

  const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  const esc = s => String(s).replace(/[&<>"]/g, c => ENT[c]);

  function schemes() {
    const list = Array.isArray(window.CONTROL_SCHEMES) && window.CONTROL_SCHEMES.length ? window.CONTROL_SCHEMES : FALLBACK_SCHEMES;
    let chosen = null;
    try { chosen = typeof window.getScheme === "function" ? window.getScheme() : null; } catch {}
    const id = (chosen && (chosen.id || chosen)) || (matchMedia("(pointer: coarse)").matches ? "touch" : list[0].id);
    return [...list].sort((a, b) => (b.id === id) - (a.id === id));   // chosen scheme first
  }

  function keysHTML() {
    return schemes().map(s => `<h3>${esc(s.label)}</h3><ul class="gd-keys">${(s.bindings || []).map(b =>
      `<li><span>${[].concat(b.keys || []).map(k => `<kbd>${esc(k)}</kbd>`).join(" ")}</span>${esc(b.text || b.action)}</li>`).join("")}</ul>`).join("");
  }

  function skillsHTML() {
    const list = window.SKILLS || [];
    if (!list.length) return "<p>Skills load with the game.</p>";
    const base = window.SKILL_BASE || 10;
    return `<p>Each skill runs 1–20. ${base} is neutral.</p>
      <p>Every point above ${base} adds the same step.</p>
      <ul class="gd-skills">${list.map(s => `<li><b>${esc(s.name)}</b>: ${esc(s.what)}<br><small>${esc(s.step)}</small></li>`).join("")}</ul>
      <p class="gd-ex">Example: Speed 15 is 5 steps above Speed ${base}.</p>`;
  }

  // Surfaces: names from the start flow when present; the feel matches pace/bounce in SURFACES (index.html).
  function surfacesHTML() {
    const names = { hard: "Hard", clay: "Red clay", grass: "Grass" };
    const feel = { hard: "Medium pace, true bounce.", clay: "Slower ball, higher bounce.", grass: "Fast ball, low bounce." };
    return `<ul>${Object.keys(names).map(id => `<li><b>${names[id]}</b>: ${feel[id]}</li>`).join("")}</ul>
      <p>You pick the court before each match.</p>`;
  }

  function html() {
    return `<div class="gd-card" role="dialog" aria-modal="true" aria-labelledby="gdTitle">
      <div class="gd-head"><h2 id="gdTitle">How to play</h2><button class="btn" type="button" data-gd-close aria-label="Close guide">Close <kbd>Esc</kbd></button></div>

      <h2>Keys</h2>${keysHTML()}

      <h2>Your feet</h2>
      <ul>
        <li>Nothing runs for you. You move every step.</li>
        <li>W goes toward the net. S goes back.</li>
        <li>Your body has momentum. Stopping takes time.</li>
        <li>Changing direction is slower than speeding up.</li>
        <li>Height and weight set your speed and reach.</li>
      </ul>

      <h2>Split step</h2>
      <ul>
        <li>Hop just as your opponent hits.</li>
        <li>Land within 0.07 s: <b>PERFECT</b>, fastest first step.</li>
        <li>Within 0.16 s: <b>GOOD</b>, a quicker first step.</li>
        <li>Too early or late: you lose time in the air.</li>
        <li>Running the wrong way at contact: <b>WRONG-FOOTED</b>.</li>
        <li>The Reflexes skill widens these windows.</li>
      </ul>

      <h2>Reach and hitting</h2>
      <ul>
        <li>The ring under you is your reach.</li>
        <li>Get the ball inside it to hit it.</li>
        <li>For now the swing is automatic.</li>
        <li>Feet set, ball not at full stretch: better shot.</li>
        <li>Stretched or tired: more errors.</li>
      </ul>

      <h2>Volleys and the net camera</h2>
      <ul>
        <li>Run past the service line toward the net.</li>
        <li>The camera moves in, low behind you.</li>
        <li>You can hit the ball before it bounces.</li>
        <li>Back off and the camera returns.</li>
        <li>Serves must always bounce first.</li>
      </ul>

      <h2>Stamina</h2>
      <ul>
        <li>Running tires you. Tired legs are slower.</li>
        <li>Between points you get back only 35%.</li>
        <li>At a changeover, 65%. After a set, 80%.</li>
        <li>Your stamina ceiling slowly drops all match.</li>
      </ul>

      <h2>Serving</h2>
      <ul>
        <li>For now the serve is automatic.</li>
        <li>Press Space to start the point.</li>
        <li>The server changes every game.</li>
        <li>Even points played: serve from the right (deuce).</li>
        <li>Odd points played: serve from the left (ad).</li>
      </ul>

      <h2>Winning a point</h2>
      <ul>
        <li>Your shot lands out: you lose the point.</li>
        <li>The ball bounces twice: the hitter wins it.</li>
      </ul>

      <h2>Scoring</h2>
      <ul>
        <li>Points go 0 (love), 15, 30, 40, game.</li>
        <li>40–40 is <b>deuce</b>.</li>
        <li>Next point: advantage (AD IN or AD OUT).</li>
        <li>Win again: game. Lose it: back to deuce.</li>
        <li>A set: first to 6 games, 2 ahead.</li>
        <li>At 6–6: a tiebreak to 7 or 10, 2 ahead.</li>
        <li>Match: best of 3 or best of 5 sets.</li>
      </ul>
      <p class="gd-ex">Example: 6–4 wins a set. 6–5 does not. 7–5 does.</p>

      <h2>Skill points</h2>${skillsHTML()}

      <h2>Courts</h2>${surfacesHTML()}
    </div>`;
  }

  let root, lastFocus;
  function open() {
    if (!root) {
      root = document.createElement("div"); root.className = "gd"; root.id = "guide";
      root.addEventListener("click", e => { if (e.target === root || e.target.closest("[data-gd-close]")) close(); });
      document.body.appendChild(root);
    }
    lastFocus = document.activeElement;
    root.innerHTML = html();          // rebuilt each time: always the current scheme and skills
    root.hidden = false;
    root.querySelector("[data-gd-close]").focus({ preventScroll: true });
    root.scrollTop = 0;
    label();
  }
  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    label();
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  const isOpen = () => !!root && !root.hidden;

  // Esc closes; while open, no key reaches the game (capture phase, before index.html's handler).
  addEventListener("keydown", e => {
    if (!isOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key !== "Tab" && e.key !== "Enter") e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  const css = document.createElement("style");
  css.textContent = `
  .gd { position: fixed; inset: 0; z-index: 30; background: rgba(5,8,16,.86); overflow-y: auto; padding: 24px 12px; }
  .gd[hidden] { display: none; }
  .gd-card { max-width: 560px; margin: 0 auto; background: var(--panel, #111a2c); color: var(--ink, #eef); border: 1px solid var(--line, #2a3550); border-radius: 8px; padding: 0 18px 22px; font: 15px/1.45 var(--f-name, system-ui, sans-serif); }
  .gd-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; position: sticky; top: -24px; background: inherit; padding: 14px 0 8px; }
  .gd-head h2 { margin: 0; font-size: 22px; }
  .gd h2 { font-size: 17px; margin: 18px 0 6px; color: var(--ball, #e6f24a); }
  .gd h3 { font-size: 13px; margin: 10px 0 4px; opacity: .8; text-transform: uppercase; letter-spacing: .05em; }
  .gd ul { margin: 0; padding-left: 18px; }
  .gd ul.gd-keys { list-style: none; padding: 0; }
  .gd-keys li { display: flex; gap: 10px; align-items: baseline; }
  .gd-keys li span { min-width: 110px; }
  .gd small { opacity: .7; }
  .gd-ex { opacity: .8; font-style: italic; margin: 6px 0 0; }
  .gd-help { position: fixed; z-index: 25; top: calc(12px + env(safe-area-inset-top, 0px)); left: calc(max(16px, env(safe-area-inset-left, 0px)) + 96px); }
  .gd-help.on-start { left: auto; right: max(16px, env(safe-area-inset-right, 0px)); }
  .gd-help.gd-off { display: none; }`;
  document.head.appendChild(css);

  // "?" button: next to Home on the match screen; "? How to play" over the start page.
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "btn gd-help"; btn.setAttribute("aria-label", "How to play");
  btn.onclick = open;
  function label() {
    const start = !!(window.StartFlow && window.StartFlow.isOpen());
    const text = start ? "? How to play" : "?";
    if (btn.textContent !== text) btn.textContent = text;   // no-op writes would re-trigger the observer
    btn.classList.toggle("on-start", start);
    btn.classList.toggle("gd-off", isOpen());
  }
  function mount() {
    document.body.appendChild(btn); label();
    new MutationObserver(label).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden"], childList: true });
  }
  document.readyState === "loading" ? addEventListener("DOMContentLoaded", mount) : mount();

  window.Guide = { open, close, isOpen };
})();
