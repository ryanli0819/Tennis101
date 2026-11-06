// =====================================================================
// CONTROL SCHEMES — how the player drives their pro. Owner: Controls Designer (agents/controls-designer/).
//
// The player picks ONE scheme (saved in localStorage `tennis101.controls`); only that scheme's
// on-screen UI and hints are shown. A scheme only says WHICH input means WHICH action. How fast you
// then move comes from the body + Speed skill in moveBody(), never from the key.
//
// Key names: keyboard keys are physical keys, named by their US-layout letter ("w", "/", "Space",
// "Shift", "ArrowUp"), so WASD sits under the same fingers on any layout. "pad:bN" is gamepad button N
// and "pad:aN+" / "pad:aN-" gamepad axis N pushed one way (W3C standard mapping). "touch:..." is an
// on-screen control.
// =====================================================================
(function () {
  const STORE = "tennis101.controls";
  const DEAD = 0.22;                                   // gamepad stick dead zone

  // Every scheme must bind all of these (src/controls/schemes.test.js checks it). Points serve by themselves
  // now, so the old `playPoint` action is retired. Serve Controller can add serve actions here later.
  const REQUIRED_ACTIONS = [
    "moveForward", "moveBack", "moveLeft", "moveRight",   // held: movement (forward = toward the net)
    "aimLeft", "aimRight", "aimLong", "aimShort",         // held: serve aim (separate from movement)
    "splitStep", "slide", "slice", "pause", "toggleView",
  ];
  const HELD = new Set(["moveForward", "moveBack", "moveLeft", "moveRight", "aimLeft", "aimRight", "aimLong", "aimShort", "slice"]);

  const CONTROL_SCHEMES = [
    { id: "wasd", label: "Keyboard · WASD", devices: ["keyboard", "mouse"], bindings: [
      { action: "moveForward", keys: ["w"], text: "W" },
      { action: "moveBack",    keys: ["s"], text: "S" },
      { action: "moveLeft",    keys: ["a"], text: "A" },
      { action: "moveRight",   keys: ["d"], text: "D" },
      { action: "aimLeft",     keys: ["ArrowLeft"],  text: "←" },
      { action: "aimRight",    keys: ["ArrowRight"], text: "→" },
      { action: "aimLong",     keys: ["ArrowUp"],    text: "↑" },
      { action: "aimShort",    keys: ["ArrowDown"],  text: "↓" },
      { action: "splitStep",   keys: ["Shift"], text: "SHIFT" },
      { action: "slide",       keys: ["Space"], text: "SPACE" },
      { action: "slice",       keys: ["e"],     text: "E" },
      { action: "pause",       keys: ["Escape"], text: "ESC" },
      { action: "toggleView",  keys: ["v"],     text: "V" },
    ] },
    { id: "arrows", label: "Keyboard · Arrows", devices: ["keyboard", "mouse"], bindings: [
      { action: "moveForward", keys: ["ArrowUp"],    text: "↑" },
      { action: "moveBack",    keys: ["ArrowDown"],  text: "↓" },
      { action: "moveLeft",    keys: ["ArrowLeft"],  text: "←" },
      { action: "moveRight",   keys: ["ArrowRight"], text: "→" },
      { action: "aimLeft",     keys: ["j"], text: "J" },
      { action: "aimRight",    keys: ["l"], text: "L" },
      { action: "aimLong",     keys: ["i"], text: "I" },
      { action: "aimShort",    keys: ["k"], text: "K" },
      { action: "splitStep",   keys: ["Shift"], text: "SHIFT" },
      { action: "slide",       keys: ["Space"], text: "SPACE" },
      { action: "slice",       keys: ["/"],     text: "/" },
      { action: "pause",       keys: ["Escape"], text: "ESC" },
      { action: "toggleView",  keys: ["v"],     text: "V" },
    ] },
    { id: "touch", label: "Touch", devices: ["touch"], bindings: [
      { action: "moveForward", keys: ["touch:drag-up"],    text: "Drag up" },
      { action: "moveBack",    keys: ["touch:drag-down"],  text: "Drag down" },
      { action: "moveLeft",    keys: ["touch:drag-left"],  text: "Drag left" },
      { action: "moveRight",   keys: ["touch:drag-right"], text: "Drag right" },
      { action: "aimLeft",     keys: ["touch:box-left"],   text: "Tap the box" },
      { action: "aimRight",    keys: ["touch:box-right"],  text: "Tap the box" },
      { action: "aimLong",     keys: ["touch:box-deep"],   text: "Tap the box" },
      { action: "aimShort",    keys: ["touch:box-short"],  text: "Tap the box" },
      { action: "splitStep",   keys: ["touch:splitBtn"], text: "Split step" },
      { action: "slide",       keys: ["touch:slideBtn"], text: "Slide" },
      { action: "slice",       keys: ["touch:sliceBtn"], text: "Slice" },
      { action: "pause",       keys: ["touch:pauseBtn"], text: "Pause" },
      { action: "toggleView",  keys: ["touch:viewBtn"],  text: "View" },
    ] },
    { id: "gamepad", label: "Gamepad", devices: ["gamepad"], bindings: [
      { action: "moveForward", keys: ["pad:a1-", "pad:b12"], text: "L-stick ↑" },
      { action: "moveBack",    keys: ["pad:a1+", "pad:b13"], text: "L-stick ↓" },
      { action: "moveLeft",    keys: ["pad:a0-", "pad:b14"], text: "L-stick ←" },
      { action: "moveRight",   keys: ["pad:a0+", "pad:b15"], text: "L-stick →" },
      { action: "aimLeft",     keys: ["pad:a2-"], text: "R-stick ←" },
      { action: "aimRight",    keys: ["pad:a2+"], text: "R-stick →" },
      { action: "aimLong",     keys: ["pad:a3-"], text: "R-stick ↑" },
      { action: "aimShort",    keys: ["pad:a3+"], text: "R-stick ↓" },
      { action: "splitStep",   keys: ["pad:b0"], text: "A / ✕" },
      { action: "slide",       keys: ["pad:b1"], text: "B / ○" },
      { action: "slice",       keys: ["pad:b5"], text: "RB / R1" },
      { action: "pause",       keys: ["pad:b9"], text: "START" },
      { action: "toggleView",  keys: ["pad:b3"], text: "Y / △" },
    ] },
  ];

  const byId = id => CONTROL_SCHEMES.find(s => s.id === id);
  const store = {
    get() { try { return localStorage.getItem(STORE); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(STORE, v); } catch (e) { /* private mode: keep it for this visit */ } },
  };
  function defaultScheme() {
    const saved = store.get();
    if (byId(saved)) return saved;
    const mm = q => typeof matchMedia === "function" && matchMedia(q).matches;
    return mm("(pointer: coarse)") && !mm("(any-pointer: fine)") ? "touch" : "wasd";
  }

  let scheme = byId(defaultScheme());
  let chosen = !!byId(store.get());                    // the player picked one themselves (don't auto-switch)
  let keyMap = new Map();                              // key → action, for the chosen scheme
  const held = new Set();                              // keyboard keys held right now
  const padHeld = new Set();                           // gamepad actions held right now
  const stick = { x: 0, y: 0 };                        // touch drag stick (y = toward the net)
  const pad = { lx: 0, ly: 0, rx: 0, ry: 0 };
  const listeners = [];

  function build() { keyMap = new Map(); scheme.bindings.forEach(b => b.keys.forEach(k => keyMap.set(k, b.action))); }
  build();

  function getScheme() { return scheme; }
  function setScheme(id, opts = {}) {
    const s = byId(id); if (!s) return scheme;
    scheme = s; build(); clearHeld();
    if (opts.save !== false) { store.set(id); chosen = true; }
    applyUI(); listeners.forEach(fn => fn(scheme));
    return scheme;
  }
  const onChange = fn => listeners.push(fn);
  const uses = device => scheme.devices.includes(device);

  /* Keyboard event → key name (physical key, US-layout letter; Shift+W is still "w"). */
  function keyOf(e) {
    const c = e.code || "";
    if (c.startsWith("Key")) return c.slice(3).toLowerCase();
    if (c.startsWith("Digit")) return c.slice(5);
    if (c === "Space") return "Space";
    if (c === "Slash") return "/";
    return e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }
  const actionFor = key => keyMap.get(key) || null;
  /* keydown / keyup: returns the action the key means in this scheme (or null). */
  function press(key) { const a = actionFor(key); if (a && HELD.has(a)) held.add(key); return a; }
  function release(key) { held.delete(key); }
  function clearHeld() { held.clear(); padHeld.clear(); stick.x = stick.y = 0; }
  function isHeld(action) {
    if (padHeld.has(action)) return true;
    for (const k of held) if (keyMap.get(k) === action) return true;
    return false;
  }
  function setStick(x, y) { stick.x = x; stick.y = y; }

  const axis = (pos, neg) => (isHeld(pos) ? 1 : 0) - (isHeld(neg) ? 1 : 0);
  const dz = v => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
  /* Movement wish, unit-ish {x, y}: x = right, y = forward (toward the net). moveBody turns it into speed. */
  function getMoveInput() {
    let x = axis("moveRight", "moveLeft"), y = axis("moveForward", "moveBack");
    if (!x && !y && uses("touch")) { x = stick.x; y = stick.y; }
    if (!x && !y && uses("gamepad")) { x = pad.lx; y = -pad.ly; }
    const m = Math.hypot(x, y);
    return m > 1 ? { x: x / m, y: y / m } : { x, y };
  }
  /* Serve aim wish {x, y}: x = right, y = deeper. */
  function getAimInput() {
    let x = axis("aimRight", "aimLeft"), y = axis("aimLong", "aimShort");
    if (!x && !y && uses("gamepad")) { x = pad.rx; y = -pad.ry; }
    return { x, y };
  }

  /* Once per frame: read the gamepad (the Gamepad API has no events for buttons). Newly pressed
     buttons call onAction(action); held ones show up in isHeld(). */
  let padPrev = new Set();
  function poll(onAction) {
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find(g => g && g.connected);
    const down = new Set();
    if (gp) {
      gp.buttons.forEach((b, n) => { if (b.pressed || b.value > 0.5) down.add("pad:b" + n); });
      gp.axes.forEach((v, n) => { if (v > 0.5) down.add(`pad:a${n}+`); else if (v < -0.5) down.add(`pad:a${n}-`); });
      [pad.lx, pad.ly, pad.rx, pad.ry] = [0, 1, 2, 3].map(n => dz(gp.axes[n] || 0));
    } else pad.lx = pad.ly = pad.rx = pad.ry = 0;
    padHeld.clear();
    if (uses("gamepad")) for (const k of down) {
      const a = keyMap.get(k); if (!a) continue;
      if (HELD.has(a)) { if (!k.startsWith("pad:a")) padHeld.add(a); }   // sticks are read as analog above
      else if (!padPrev.has(k) && onAction) onAction(a);
    }
    padPrev = down;
    if (gp && !chosen && !uses("gamepad")) setScheme("gamepad", { save: false });   // a pad shows up: offer it
  }

  /* Hint text for one action in the chosen scheme ("W", "SHIFT", "A / ✕"). */
  const textFor = action => { const b = scheme.bindings.find(b => b.action === action); return b ? b.text : ""; };
  function hintLine() {
    if (uses("touch")) return "";
    const t = textFor;
    const four = (a, b, c, d) => [t(a), t(b), t(c), t(d)].join("");
    return uses("gamepad")
      ? `L-stick move · ${t("splitStep")} split · ${t("slide")} slide · ${t("slice")} slice · R-stick aim · ${t("toggleView")} view`
      : `${four("moveForward", "moveLeft", "moveBack", "moveRight")} move · ${t("splitStep")} split · ${t("slide")} slide · ${t("slice")} slice (hold) · ${four("aimLeft", "aimLong", "aimShort", "aimRight")} or click the box: aim · ${t("toggleView")} view`;
  }

  /* Show only the chosen scheme's UI: elements marked data-scheme="touch" (stick, Split / Slide / Slice
     buttons) only for touch; <kbd data-action="…"> show that action's key, hidden when there is none. */
  function applyUI() {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.controls = scheme.id;
    document.querySelectorAll("[data-scheme]").forEach(el => {
      el.hidden = !el.dataset.scheme.split(" ").some(d => uses(d));
    });
    document.querySelectorAll("kbd[data-action]").forEach(k => {
      const txt = uses("touch") ? "" : textFor(k.dataset.action);
      k.textContent = txt; k.hidden = !txt;
    });
    const hint = document.getElementById("keyHints");
    if (hint) { hint.textContent = hintLine(); hint.hidden = !hint.textContent; }
    document.querySelectorAll("select[data-controls-picker]").forEach(s => (s.value = scheme.id));
  }
  /* A <select> of all schemes; changing it switches (and saves) the scheme. */
  function mountPicker(sel) {
    sel.dataset.controlsPicker = "";
    sel.innerHTML = CONTROL_SCHEMES.map(s => `<option value="${s.id}">${s.label}</option>`).join("");
    sel.value = scheme.id;
    sel.addEventListener("change", () => setScheme(sel.value));
  }

  const api = { CONTROL_SCHEMES, REQUIRED_ACTIONS, HELD, getScheme, setScheme, onChange, uses, keyOf, actionFor,
                press, release, clearHeld, isHeld, setStick, getMoveInput, getAimInput, poll, textFor, hintLine,
                applyUI, mountPicker };
  if (typeof window !== "undefined") {
    window.Controls = api;
    window.CONTROL_SCHEMES = CONTROL_SCHEMES;
    window.getMoveInput = getMoveInput;
    window.setScheme = setScheme;
    window.getScheme = getScheme;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
