// =====================================================================
// SKILL POINTS — what each point does to a player. Owner: Skills Coach (agents/skills-coach/).
//
// Every skill runs 1–20 and 10 is neutral. Each point above (or below) 10 changes one feature by a
// CONSTANT step, so 15 Speed is always exactly 5 steps faster than 10, whoever the player is.
// Skills add on top of the body (height and weight), they never replace it.
// Ball speed effects (Strength, Serve) are shared with the Ball Physicist: keep the m/s steps in sync
// (issue #2). All the numbers live in STEP; applySkills and the locker-room text both read them.
// =====================================================================
(function () {
  const BASE = 10, MIN = 1, MAX = 20;

  // The constant step per point above 10 (fractions are ×, m/s and m are added, s for split windows).
  const STEP = {
    top: 0.02,           // Speed: +2% top speed
    accel: 0.025,        // Agility: +2.5% first step and braking
    slide: 0.03,         // Agility: +3% slide distance
    drain: 0.03,         // Endurance: −3% stamina used
    recover: 0.02,       // Endurance: +2% recovered between points
    shot: 0.6,           // Strength: +0.6 m/s groundstroke speed
    serve: 0.9,          // Serve: +0.9 m/s serve speed
    err: 0.04,           // Control: −4% error chance
    aim: 0.05,           // Control: +5 cm wider aim
    splitPerfect: 0.004, // Reflexes: +4 ms PERFECT split window
    splitGood: 0.006,    // Reflexes: +6 ms GOOD split window
    reaction: 0.006,     // Reflexes: −6 ms reaction (computer player)
    volleyReach: 0.02,   // Net play: +2% reach at the net
    volleyErr: 0.05,     // Net play: −5% volley errors
  };
  // Floors and ceilings: at 1 or 20 every multiplier stays inside these, so no skill breaks the physics.
  const FLOOR = { mul: 0.5, err: 0.2 };

  const pct = v => `${+(v * 100).toFixed(1)}%`, ms = v => `${Math.round(v * 1000)} ms`;

  // id · name · what it changes · the constant step per point (shown in the locker room)
  const SKILLS = [
    { id: "speed",     name: "Speed",     what: "Top running speed",                    step: `+${pct(STEP.top)} top speed per point` },
    { id: "agility",   name: "Agility",   what: "First step, braking, changing direction, slides", step: `+${pct(STEP.accel)} acceleration and braking, +${pct(STEP.slide)} slide distance per point` },
    { id: "endurance", name: "Endurance", what: "How slowly you tire, how fast you recover", step: `−${pct(STEP.drain)} stamina used, +${pct(STEP.recover)} recovered per point` },
    { id: "strength",  name: "Strength",  what: "How fast your groundstrokes leave the racket", step: `+${STEP.shot} m/s ball speed per point` },
    { id: "serve",     name: "Serve",     what: "Serve speed",                          step: `+${STEP.serve} m/s serve speed per point` },
    { id: "control",   name: "Control",   what: "Ball control: fewer errors, sharper angles", step: `−${pct(STEP.err)} error chance, +${Math.round(STEP.aim * 100)} cm wider aim per point` },
    { id: "reflexes",  name: "Reflexes",  what: "Split-step timing window and reaction", step: `+${ms(STEP.splitPerfect)} perfect split-step window per point` },
    { id: "netPlay",   name: "Net play",  what: "Volleys and touch at the net",         step: `+${pct(STEP.volleyReach)} volley reach, −${pct(STEP.volleyErr)} volley errors per point` },
  ];
  const IDS = SKILLS.map(s => s.id);

  // Starting skills. First estimates from how each pro plays; the Skills Coach tunes these.
  // Sinner: clean, powerful baseline game and elite returns. Alcaraz: fastest mover, best at the net.
  const PLAYER_SKILLS = {
    sinner:  { speed: 15, agility: 15, endurance: 16, strength: 17, serve: 16, control: 17, reflexes: 18, netPlay: 12 },
    alcaraz: { speed: 18, agility: 19, endurance: 16, strength: 16, serve: 14, control: 15, reflexes: 16, netPlay: 17 },
  };

  // A skill value: a whole number in 1–20. Anything that isn't a number (a broken save) falls back.
  const clamp = (v, fallback = BASE) => {
    const n = Number(v);
    return Number.isFinite(n) && v !== null && v !== "" ? Math.max(MIN, Math.min(MAX, Math.round(n))) : fallback;
  };

  // Skills for a player: the defaults, plus any saved changes in the profile (kept outside a match).
  // Only the 8 known skills are read from the save, and each is checked, so a bad save can't make NaN bodies.
  function getSkills(id) {
    const def = PLAYER_SKILLS[id] || {}, out = {};
    let saved = {};
    try {
      const s = JSON.parse(localStorage.getItem("tennis101.profile") || "{}")?.players?.[id]?.skills;
      if (s && typeof s === "object") saved = s;
    } catch {}
    for (const k of IDS) out[k] = clamp(saved[k], clamp(def[k]));
    return out;
  }

  // Apply skills to the body numbers from bodyStats(). n = points above 10 (negative below).
  function applySkills(body, sk) {
    const n = id => clamp(sk?.[id]) - BASE;
    const mul = (step, pts) => Math.max(FLOOR.mul, 1 + step * pts);
    return {
      ...body,
      top:          body.top   * mul(STEP.top, n("speed")),             // Speed: faster across the court
      accel:        body.accel * mul(STEP.accel, n("agility")),         // Agility: quicker first step
      brake:        body.brake * mul(STEP.accel, n("agility")),         //          and quicker to stop / turn
      slideMul:     mul(STEP.slide, n("agility")),                      //          and longer slides
      drain:        body.drain * mul(-STEP.drain, n("endurance")),      // Endurance: tire more slowly
      recoverMul:   mul(STEP.recover, n("endurance")),                  //            recover more between points
      shotBonus:    STEP.shot * n("strength"),                          // Strength: + m/s on groundstrokes
      serveBonus:   STEP.serve * n("serve"),                            // Serve: + m/s on serves
      errMul:       Math.max(FLOOR.err, 1 - STEP.err * n("control")),   // Control: fewer errors
      aimBonus:     STEP.aim * n("control"),                            //          wider, sharper aim (m)
      splitPerfect: 0.07 + STEP.splitPerfect * n("reflexes"),           // Reflexes: wider PERFECT split window (s)
      splitGood:    0.16 + STEP.splitGood * n("reflexes"),              //           and GOOD window
      reactionCut:  STEP.reaction * n("reflexes"),                      //           faster reactions (computer player)
      volleyReach:  mul(STEP.volleyReach, n("netPlay")),                // Net play: reach further at the net
      volleyErrMul: Math.max(FLOOR.err, 1 - STEP.volleyErr * n("netPlay")), //       fewer volley errors
    };
  }

  window.SKILLS = SKILLS;
  window.SKILL_BASE = BASE;
  window.SKILL_STEP = STEP;
  window.SKILL_FLOOR = FLOOR;
  window.PLAYER_SKILLS = PLAYER_SKILLS;
  window.getSkills = getSkills;
  window.applySkills = applySkills;
})();
