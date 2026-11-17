/* HANDEDNESS — which hand each pro holds the racket in. One table, no default.
   SOURCED: each player's ATP Tour profile, "Plays:" line (PlayHand in the profile's hero data,
   https://www.atptour.com/en/-/www/players/hero/<code>), read Nov 17, 2026 (HQ-20261116-001).
   Cross-checked against the hand tags in src/serve/motion/roster-serves.js: all 22 agree.
   Owner: Player Artist. Static script: works as <script> in the page and via require/vm in node.
   An unknown or missing id is an ERROR (console.error + throw). Never fall back to right-handed. */
(function (root) {
  const ATP = "https://www.atptour.com/en/players/";
  const T = {
    "zverev":            { lefty: false, plays: "Right-Handed", source: ATP + "alexander-zverev/z355/overview", label: "SOURCED" },
    "sinner":            { lefty: false, plays: "Right-Handed", source: ATP + "jannik-sinner/s0ag/overview", label: "SOURCED" },
    "alcaraz":           { lefty: false, plays: "Right-Handed", source: ATP + "carlos-alcaraz/a0e2/overview", label: "SOURCED" },
    "shelton":           { lefty: true,  plays: "Left-Handed",  source: ATP + "ben-shelton/s0s1/overview", label: "SOURCED" },
    "medvedev":          { lefty: false, plays: "Right-Handed", source: ATP + "daniil-medvedev/mm58/overview", label: "SOURCED" },
    "cobolli":           { lefty: false, plays: "Right-Handed", source: ATP + "flavio-cobolli/c0e9/overview", label: "SOURCED" },
    "fils":              { lefty: false, plays: "Right-Handed", source: ATP + "arthur-fils/f0f1/overview", label: "SOURCED" },
    "tiafoe":            { lefty: false, plays: "Right-Handed", source: ATP + "frances-tiafoe/td51/overview", label: "SOURCED" },
    "de-minaur":         { lefty: false, plays: "Right-Handed", source: ATP + "alex-de-minaur/dh58/overview", label: "SOURCED" },
    "jodar":             { lefty: false, plays: "Right-Handed", source: ATP + "rafael-jodar/j0dz/overview", label: "SOURCED" },
    "djokovic":          { lefty: false, plays: "Right-Handed", source: ATP + "novak-djokovic/d643/overview", label: "SOURCED" },
    "fritz":             { lefty: false, plays: "Right-Handed", source: ATP + "taylor-fritz/fb98/overview", label: "SOURCED" },
    "auger-aliassime":   { lefty: false, plays: "Right-Handed", source: ATP + "felix-auger-aliassime/ag37/overview", label: "SOURCED" },
    "paul":              { lefty: false, plays: "Right-Handed", source: ATP + "tommy-paul/pl56/overview", label: "SOURCED" },
    "lehecka":           { lefty: false, plays: "Right-Handed", source: ATP + "jiri-lehecka/l0bv/overview", label: "SOURCED" },
    "mensik":            { lefty: false, plays: "Right-Handed", source: ATP + "jakub-mensik/m0ni/overview", label: "SOURCED" },
    "davidovich-fokina": { lefty: false, plays: "Right-Handed", source: ATP + "alejandro-davidovich-fokina/dh50/overview", label: "SOURCED" },
    "nakashima":         { lefty: false, plays: "Right-Handed", source: ATP + "brandon-nakashima/n0ae/overview", label: "SOURCED" },
    "tien":              { lefty: true,  plays: "Left-Handed",  source: ATP + "learner-tien/t0ha/overview", label: "SOURCED" },
    "federer":           { lefty: false, plays: "Right-Handed", source: ATP + "roger-federer/f324/overview", label: "SOURCED" },   // one-handed backhand (BackHand "1"); still right-handed
    "nadal":             { lefty: true,  plays: "Left-Handed",  source: ATP + "rafael-nadal/n409/overview", label: "SOURCED" },
    "kyrgios":           { lefty: false, plays: "Right-Handed", source: ATP + "nick-kyrgios/ke17/overview", label: "SOURCED" },
  };
  for (const id in T) Object.freeze(T[id]);
  Object.freeze(T);
  /* lefty(id) → true | false. Throws (after console.error) for an id that is not in the table. */
  function lefty(id) {
    const row = Object.prototype.hasOwnProperty.call(T, id) ? T[id] : null;
    if (!row || typeof row.lefty !== "boolean") {
      const msg = "HANDEDNESS: no sourced handedness for player id " + JSON.stringify(id) + " (src/players/handedness.js). Add the ATP 'Plays:' row; there is no default.";
      if (typeof console !== "undefined") console.error(msg);
      throw new Error(msg);
    }
    return row.lefty;
  }
  /* +1 = right-handed, −1 = left-handed: the sign that puts the racket on the player's own racket side. */
  const handSign = id => (lefty(id) ? -1 : 1);
  const api = Object.freeze({ TABLE: T, ids: Object.freeze(Object.keys(T)), lefty, handSign });
  root.HANDEDNESS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
