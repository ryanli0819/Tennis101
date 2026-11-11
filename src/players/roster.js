// =====================================================================
// ROSTER — the other 20 pros (Sinner and Alcaraz stay in index.html).
// Owner: Player Artist. Facts: datasets/players/<id>/appearance.json.
//
// heightM / weightKg / lefty / backhand are sourced (see each appearance.json).
// letRate, look.torso, skill points and any outfit with
// hexKind "game-design-default" are game-design choices, not measurements.
// HUD `shirt` is a scoreboard colour, same idea as Sinner's teal: the court
// kit comes from `outfits`, and `ui` keeps this colour.
// =====================================================================
(function () {
  const WHITE = "#f4f4f0";
  const NAVY = "#1c2a44";
  const DUST = "#3e4c5c";

  function kit(over) {
    const g = { shirt: WHITE, shorts: WHITE, shoes: WHITE, socks: WHITE, hexKind: "dress-code", event: "Wimbledon",
      notes: "All-white grass-court dress code. Trim was not sampled from a photo." };
    const h = { shirt: NAVY, shorts: WHITE, shoes: WHITE, socks: WHITE, hexKind: "game-design-default", event: "US Open",
      notes: "Neutral default kit. A citable US Open colour was not found for this run." };
    const c = { shirt: DUST, shorts: WHITE, shoes: WHITE, socks: WHITE, hexKind: "game-design-default", event: "Roland-Garros (red clay)",
      notes: "Neutral default kit. A citable clay colour was not found for this run." };
    over = over || {};
    return {
      grass: Object.assign({}, g, over.grass || {}),
      hard: Object.assign({}, h, over.hard || {}),
      clay: Object.assign({}, c, over.clay || {}),
    };
  }

  function pro(p) {
    return {
      id: p.id, last: p.last, first: p.first, code: p.code,
      heightM: p.h, weightKg: p.w, shirt: p.ui, shorts: WHITE, hair: p.hair,
      letRate: p.let == null ? 0.02 : p.let, lefty: !!p.lefty, backhand: p.bh || "two",
      outfits: kit(p.kits), look: p.look,
    };
  }

  const DARK = "#2a1c14", BROWN = "#6b4428", LIGHT = "#a67c52", BLOND = "#e4c98a";

  // Order matches datasets/footage/top20.json `players`, skipping Sinner and Alcaraz.
  const ROSTER_REST = [
    pro({ id: "zverev", last: "ZVEREV", first: "Alexander", code: "GER", h: 1.98, w: 89, ui: "#6b4c9a", hair: BLOND, let: 0.02,
      look: { style: "headband", band: WHITE, torso: 0.92, volume: true },
      kits: {
        grass: { band: WHITE },
        hard: { shirt: "#5c3d78", shorts: "#5c3d78", shoes: "#f4f4f0", socks: WHITE, band: "#6e4c96", hexKind: "named-colour-approximate",
          notes: "2025 US Open: grape-purple shirt, shorts and headband; white/black shoes (Harper's Bazaar). Hex is an approximation of that description, not a photo sample." },
        clay: { band: WHITE },
      } }),
    pro({ id: "shelton", last: "SHELTON", first: "Ben", code: "USA", h: 1.93, w: 88, ui: "#e23b6a", hair: "#241810", lefty: true,
      look: { style: "headband", band: WHITE, torso: 1.16, wavy: true },
      kits: {
        grass: { band: WHITE },
        hard: { shirt: "#8e9299", shorts: WHITE, shoes: "#e56a9a", socks: WHITE, band: WHITE, sleeveless: true, hexKind: "named-colour-approximate",
          notes: "2025 US Open day 1: space-grey and white sleeveless kit, pink shoes (Sportskeeda). White headband and dark wavy hair are from the Paris 2026 indoor-hard clip (style.json), a different event: that kit was dark navy." },
        clay: { band: WHITE },
      } }),
    pro({ id: "medvedev", last: "MEDVEDEV", first: "Daniil", code: "RUS", h: 1.98, w: 82, ui: "#3d6b4f", hair: DARK,
      look: { style: "crop", torso: 0.74 },
      kits: {
        hard: { shirt: "#6b3d8f", shorts: "#6b3d8f", shoes: "#6b3d8f", socks: "#2a2030", hexKind: "named-colour-approximate",
          notes: "2025 US Open: purple kit and purple shoes (The Second Serve shoe report). Hex approximates 'purple'." },
      } }),
    pro({ id: "cobolli", last: "COBOLLI", first: "Flavio", code: "ITA", h: 1.83, w: 74, ui: "#c47b2a", hair: BROWN,
      look: { style: "waves", torso: 0.98 } }),
    pro({ id: "fils", last: "FILS", first: "Arthur", code: "FRA", h: 1.85, w: 82, ui: "#1f6b4a", hair: DARK,
      look: { style: "crop", torso: 1.12 } }),
    pro({ id: "tiafoe", last: "TIAFOE", first: "Frances", code: "USA", h: 1.88, w: 86, ui: "#e23d3d", hair: DARK,
      look: { style: "headband", band: WHITE, torso: 1.14 },
      kits: {
        grass: { band: WHITE },
        hard: { shirt: "#d21f2a", shorts: "#d21f2a", shoes: WHITE, socks: WHITE, band: WHITE, hexKind: "named-colour-approximate",
          notes: "2025 US Open: bright red kit (Sports Illustrated). Headband colour that week was not named; the white band is the grass-court accessory carried over, not a sampled US Open band." },
      } }),
    pro({ id: "de-minaur", last: "DE MINAUR", first: "Alex", code: "AUS", h: 1.83, w: 68, ui: "#1a6b8a", hair: DARK,
      look: { style: "cap", torso: 0.82 },
      kits: {
        grass: { cap: WHITE },
        hard: { cap: "#1a1a1e" },
        clay: { cap: WHITE },
      } }),
    pro({ id: "jodar", last: "JODAR", first: "Rafael", code: "ESP", h: 1.91, w: 70, ui: "#c45a2a", hair: DARK,
      look: { style: "crop", torso: 0.84 } }),
    pro({ id: "djokovic", last: "DJOKOVIC", first: "Novak", code: "SRB", h: 1.88, w: 77, ui: "#3d7ab5", hair: DARK,
      look: { style: "crop", torso: 0.90 },
      kits: {
        hard: { shirt: "#161616", shorts: "#161616", shoes: "#161616", socks: "#1a1a1a", hexKind: "named-colour-approximate",
          notes: "2025 US Open: all-black Lacoste kit, gold piping (Lacoste's own New York collection note, and Sports Illustrated). Gold piping is not drawn as a logo." },
      } }),
    pro({ id: "fritz", last: "FRITZ", first: "Taylor", code: "USA", h: 1.96, w: 86, ui: "#d4a017", hair: LIGHT,
      look: { style: "headband", band: WHITE, torso: 1.10 },
      kits: {
        grass: { band: WHITE },
        hard: { shirt: "#4a4e55", shorts: "#1c1c20", shoes: "#2f6fbf", socks: WHITE, band: WHITE, hexKind: "named-colour-approximate",
          notes: "2025 US Open day 1: dark-grey shirt, black shorts, blue shoes (Sportskeeda). Headband colour that day was not named; white is the unconfirmed default." },
        clay: { band: WHITE },
      } }),
    pro({ id: "auger-aliassime", last: "AUGER-ALIASSIME", first: "Felix", code: "CAN", h: 1.93, w: 88, ui: "#c43b3b", hair: DARK,
      look: { style: "crop", torso: 1.06, wavy: true } }),
    pro({ id: "paul", last: "PAUL", first: "Tommy", code: "USA", h: 1.85, w: 81, ui: "#3a7bd5", hair: "#3a2618",
      look: { style: "crop", torso: 1.0 } }),
    pro({ id: "lehecka", last: "LEHECKA", first: "Jiri", code: "CZE", h: 1.85, w: 81, ui: "#e07a3d", hair: DARK,
      look: { style: "crop", torso: 1.02 } }),
    pro({ id: "mensik", last: "MENSIK", first: "Jakub", code: "CZE", h: 1.96, w: 86, ui: "#5b8f3a", hair: "#5a3a28",
      look: { style: "crop", torso: 0.88 } }),
    pro({ id: "davidovich-fokina", last: "DAVIDOVICH FOKINA", first: "Alejandro", code: "ESP", h: 1.83, w: 79, ui: "#8a3d6b", hair: DARK,
      look: { style: "mop", torso: 1.0 } }),
    pro({ id: "nakashima", last: "NAKASHIMA", first: "Brandon", code: "USA", h: 1.88, w: 83, ui: "#3d5a8a", hair: DARK,
      look: { style: "crop", torso: 0.94 } }),
    pro({ id: "tien", last: "TIEN", first: "Learner", code: "USA", h: 1.80, w: 72, ui: "#d46a2a", hair: DARK, lefty: true,
      look: { style: "crop", torso: 0.86 } }),
    pro({ id: "nadal", last: "NADAL", first: "Rafael", code: "ESP", h: 1.85, w: 85, ui: "#c4a035", hair: DARK, lefty: true, let: 0.03,
      look: { style: "bandana", band: "#7a2430", torso: 1.14, longHair: true, sleeveless: true, capri: true },
      kits: {
        grass: { band: WHITE, notes: "All-white dress code, including a white bandana. Pirate-length pants at Wimbledon are the chosen era and are still marked to confirm in appearance.json." },
        hard: { band: "#7a2430", notes: "Pirate-era silhouette (sleeveless, capri, bandana). The 2005–08 US Open colours were not read from a still; the navy shirt is a neutral default and the bandana red is not a sourced hex." },
        clay: { shirt: "#e6c34a", shorts: WHITE, shoes: WHITE, socks: WHITE, band: "#7a2430", hexKind: "named-colour-approximate",
          notes: "2005 clay: yellow shirt and white pirate trousers (already cited in appearance.json). Bandana red is not in that report; the yellow and white are." },
      } }),
    pro({ id: "federer", last: "FEDERER", first: "Roger", code: "SUI", h: 1.85, w: 85, ui: "#c43b4a", hair: DARK, bh: "one", let: 0.02,
      look: { style: "headband", band: WHITE, torso: 0.96, flop: true },
      kits: {
        grass: { band: WHITE },
        hard: { shirt: WHITE, shorts: WHITE, shoes: WHITE, band: WHITE, hexKind: "withheld",
          notes: "Headband era. The 2026 media guide and the appearance file do not give a US Open shirt colour, so the shirt stays white rather than a guessed polo colour. The white headband is the signature." },
        clay: { shirt: WHITE, shorts: WHITE, shoes: WHITE, band: WHITE, hexKind: "withheld",
          notes: "Clay shirt colour withheld for the same reason. White headband stays." },
      } }),
    pro({ id: "kyrgios", last: "KYRGIOS", first: "Nick", code: "AUS", h: 1.93, w: 84, ui: "#e03a3a", hair: DARK,
      look: { style: "cap-back", torso: 0.96 },
      kits: {
        grass: { cap: WHITE, notes: "All-white dress code, cap worn backwards. Red shoes were a post-match gesture against the dress code (appearance.json), so they are not the in-point grass kit." },
        hard: { shirt: "#1a1a1e", shorts: "#1a1a1e", shoes: "#c4362c", cap: "#c4362c", socks: "#1a1a1e", hexKind: "named-colour-approximate",
          notes: "2022 look from appearance.json: cap backwards, red cap and red shoes as a statement. Shirt colour for a specific US Open was not sourced; black is a neutral field for the red cap to read on. Hex approximates 'red' and 'black'." },
        clay: { cap: WHITE, notes: "He rarely plays clay (appearance.json). Cap backwards, colours otherwise the neutral default." },
      } }),
  ];

  // Three-tone hair. Dark hair shares one palette: the files say "dark" or "short dark", not a sampled hex.
  const HAIR = {
    zverev: ["#e4c98a", "#c4a15a", "#f6e7c2"],
    shelton: ["#241810", "#100c08", "#4a3428"],
    fritz: ["#a67c52", "#6e4e32", "#d4b48a"],
    cobolli: ["#6b4428", "#3e2616", "#a67c52"],
    mensik: ["#5a3a28", "#3a2418", "#8a6248"],
    paul: ["#3a2618", "#1c120c", "#5c4030"],
  };
  const DARK3 = ["#2a1c14", "#120b07", "#4d3626"];
  for (const p of ROSTER_REST) if (!HAIR[p.id]) HAIR[p.id] = DARK3;

  // Frame and a painted accent. No brand marks. Accent follows the HUD colour.
  const RACKET = {};
  for (const p of ROSTER_REST) RACKET[p.id] = { frame: "#1d1d22", accent: p.shirt };
  RACKET.shelton = { frame: "#24324a", accent: "#e36a2a" }; // style.json: multicoloured frame, no logo
  RACKET.kyrgios = { frame: "#1d1d22", accent: "#c4362c" };

  // Where a slice finish sits on the clock. Game-design, same scale as Sinner 4 / Alcaraz 5.
  const SLICE_END = {};
  for (const p of ROSTER_REST) SLICE_END[p.id] = p.backhand === "one" ? 3.5 : 4.5;
  SLICE_END.shelton = 5;
  SLICE_END.nadal = 5;
  SLICE_END.federer = 3.5;

  // Skill points are game-design, anchored on the published style notes (big serve, speed, touch).
  // 10 is neutral. They are not a measured rating.
  const SK = (speed, agility, endurance, strength, serve, control, reflexes, netPlay) =>
    ({ speed, agility, endurance, strength, serve, control, reflexes, netPlay });
  const ROSTER_SKILLS = {
    zverev:            SK(13, 12, 15, 17, 18, 14, 13, 11),
    shelton:           SK(15, 14, 14, 17, 19, 12, 14, 15),
    medvedev:          SK(14, 13, 16, 14, 16, 16, 15, 10),
    cobolli:           SK(16, 16, 15, 14, 13, 14, 15, 12),
    fils:              SK(16, 16, 14, 16, 15, 13, 15, 13),
    tiafoe:            SK(15, 15, 14, 15, 15, 13, 14, 14),
    "de-minaur":       SK(19, 19, 18, 12, 13, 16, 18, 12),
    jodar:             SK(15, 14, 13, 15, 14, 12, 13, 11),
    djokovic:          SK(16, 17, 19, 15, 16, 18, 19, 14),
    fritz:             SK(13, 12, 14, 16, 18, 14, 13, 12),
    "auger-aliassime": SK(14, 14, 14, 16, 17, 13, 14, 13),
    paul:              SK(16, 17, 15, 14, 14, 15, 16, 13),
    lehecka:           SK(15, 14, 14, 16, 16, 14, 14, 12),
    mensik:            SK(13, 12, 13, 16, 18, 13, 13, 11),
    "davidovich-fokina": SK(15, 16, 14, 14, 12, 15, 15, 13),
    nakashima:         SK(14, 14, 14, 14, 14, 15, 14, 12),
    tien:              SK(16, 17, 14, 12, 13, 16, 16, 12),
    nadal:             SK(16, 16, 19, 18, 15, 16, 16, 14),
    federer:           SK(15, 16, 16, 16, 16, 19, 17, 18),
    kyrgios:           SK(14, 14, 12, 17, 19, 13, 15, 16),
  };

  window.ROSTER_REST = ROSTER_REST;
  window.PlayerArt = Object.assign(window.PlayerArt || {}, { HAIR, RACKET, SLICE_END });
  if (window.PLAYER_SKILLS) Object.assign(window.PLAYER_SKILLS, ROSTER_SKILLS);
  window.ROSTER_SKILLS = ROSTER_SKILLS;
})();
