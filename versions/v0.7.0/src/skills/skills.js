// =====================================================================
// SKILL POINTS — what each point does to a player. Owner: Skills Coach (agents/skills-coach/).
//
// Every skill runs 1–20 and 10 is neutral. Each point above (or below) 10 changes one feature by a
// CONSTANT step, so 15 Speed is always exactly 5 steps faster than 10, whoever the player is.
// Skills add on top of the body (height and weight), they never replace it.
// Ball speed effects (Strength, Serve) are shared with the Ball Physicist: keep the m/s steps in sync.
// =====================================================================
(function () {
  const BASE = 10;

  // id · name · what it changes · the constant step per point (shown in the locker room)
  const SKILLS = [
    { id: "speed",     name: "Speed",     what: "Top running speed",                    step: "+2% top speed per point" },
    { id: "agility",   name: "Agility",   what: "First step, braking, changing direction", step: "+2.5% acceleration and braking per point" },
    { id: "endurance", name: "Endurance", what: "How slowly you tire, how fast you recover", step: "−3% stamina used, +2% recovered per point" },
    { id: "strength",  name: "Strength",  what: "How fast your groundstrokes leave the racket", step: "+0.6 m/s ball speed per point" },
    { id: "serve",     name: "Serve",     what: "Serve speed",                          step: "+0.9 m/s serve speed per point" },
    { id: "control",   name: "Control",   what: "Ball control: fewer errors, sharper angles", step: "−4% error chance, +5 cm wider aim per point" },
    { id: "reflexes",  name: "Reflexes",  what: "Split-step timing window and reaction", step: "+4 ms perfect split-step window per point" },
    { id: "netPlay",   name: "Net play",  what: "Volleys and touch at the net",         step: "+2% volley reach, −5% volley errors per point" },
  ];

  // Starting skills. First estimates from how each pro plays; the Skills Coach tunes these.
  // Sinner: clean, powerful baseline game and elite returns. Alcaraz: fastest mover, best at the net.
  const PLAYER_SKILLS = {
    sinner:  { speed: 15, agility: 15, endurance: 16, strength: 17, serve: 16, control: 17, reflexes: 18, netPlay: 12 },
    alcaraz: { speed: 18, agility: 19, endurance: 16, strength: 16, serve: 14, control: 15, reflexes: 16, netPlay: 17 },
  };

  const clamp = v => Math.max(1, Math.min(20, Math.round(v)));

  // Skills for a player: the defaults, plus any saved changes in the profile (kept outside a match).
  function getSkills(id) {
    const base = { ...(PLAYER_SKILLS[id] || {}) };
    try {
      const saved = JSON.parse(localStorage.getItem("tennis101.profile") || "{}");
      Object.assign(base, saved?.players?.[id]?.skills || {});
    } catch {}
    for (const s of SKILLS) base[s.id] = clamp(base[s.id] ?? BASE);
    return base;
  }

  // Apply skills to the body numbers from bodyStats(). n = points above 10 (negative below).
  function applySkills(body, sk) {
    const n = id => (sk[id] ?? BASE) - BASE;
    return {
      ...body,
      top:          body.top   * (1 + 0.02  * n("speed")),      // Speed: faster across the court
      accel:        body.accel * (1 + 0.025 * n("agility")),    // Agility: quicker first step
      brake:        body.brake * (1 + 0.025 * n("agility")),    //          and quicker to stop / turn
      drain:        body.drain * (1 - 0.03  * n("endurance")),  // Endurance: tire more slowly
      recoverMul:   1 + 0.02 * n("endurance"),                  //            recover more between points
      shotBonus:    0.6 * n("strength"),                        // Strength: + m/s on groundstrokes
      serveBonus:   0.9 * n("serve"),                           // Serve: + m/s on serves
      errMul:       Math.max(0.2, 1 - 0.04 * n("control")),     // Control: fewer errors
      aimBonus:     0.05 * n("control"),                        //          wider, sharper aim (m)
      splitPerfect: 0.07 + 0.004 * n("reflexes"),               // Reflexes: wider PERFECT split window (s)
      splitGood:    0.16 + 0.006 * n("reflexes"),               //           and GOOD window
      reactionCut:  0.006 * n("reflexes"),                      //           faster reactions (computer player)
      volleyReach:  1 + 0.02 * n("netPlay"),                    // Net play: reach further at the net
      volleyErrMul: Math.max(0.2, 1 - 0.05 * n("netPlay")),     //           fewer volley errors
    };
  }

  window.SKILLS = SKILLS;
  window.SKILL_BASE = BASE;
  window.PLAYER_SKILLS = PLAYER_SKILLS;
  window.getSkills = getSkills;
  window.applySkills = applySkills;
})();
