// =====================================================================
// LOCKER ROOM — pick your pro and see their body and skill points. Owner: Locker Room Designer
// (agents/locker-room-designer/). Reads players from the game's ROSTER and skills from src/skills/.
//
// Lockerroom.render(el, { roster, bodyStats, selected, onSelect(id) })
// Everything comes from the roster: a new pro needs no code here. Optional roster fields:
//   hand: "left" | "right" (default right), backhand: "one" | "two" (default two).
// A portrait from the Player Artist is used when window.PlayerArt.portrait(P) exists.
// =====================================================================
(function () {
  const css = `
  .lr { display: grid; gap: 14px; }
  .lr-wall { height: 26px; border-radius: 6px; border: 1px solid var(--line); image-rendering: pixelated;
             background: repeating-linear-gradient(90deg, #26324d 0 46px, #1a2338 46px 48px),
                         linear-gradient(#2c3a5a, #1d2740); position: relative; overflow: hidden; }
  .lr-wall::before { content: ""; position: absolute; inset: 6px 0 auto 0; height: 6px;
             background: repeating-linear-gradient(90deg, transparent 0 10px, #141b2c 10px 32px, transparent 32px 48px); opacity: .7; }
  .lr-wall::after { content: "LOCKER ROOM"; position: absolute; right: 8px; bottom: 4px; font: 8px var(--f-pix); letter-spacing: .1em; color: var(--muted); }
  .lr-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; }
  .lr-card { position: relative; text-align: left; font: inherit; color: var(--ink); background: var(--panel-2); border: 1px solid var(--line);
             border-radius: 8px; padding: 14px; cursor: pointer; display: grid; gap: 10px; }
  .lr-card:hover { border-color: #3c5180; }
  .lr-card[aria-checked="true"] { border-color: var(--ball); box-shadow: inset 0 0 0 1px var(--ball); }
  .lr-card:focus-visible { outline: 2px solid var(--ball); outline-offset: 2px; }
  .lr-top { display: flex; gap: 12px; align-items: center; }
  .lr-sprite { width: 44px; height: 64px; flex: none; image-rendering: pixelated; }
  .lr-name { font: 700 26px/1 var(--f-name); }
  .lr-name small { display: block; font: 8px var(--f-pix); letter-spacing: .08em; color: var(--muted); margin-top: 5px; }
  .lr-pick { position: absolute; top: 12px; right: 12px; font: 8px var(--f-pix); letter-spacing: .08em; padding: 4px 6px; border-radius: 3px;
             background: var(--ball); color: var(--chip-ink); }
  .lr-card[aria-checked="false"] .lr-pick { display: none; }
  .lr-body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .lr-body div { background: var(--panel); border-radius: 5px; padding: 6px 8px; }
  .lr-body b { display: block; font: 600 18px var(--f-num); }
  .lr-body span { font: 8px var(--f-pix); letter-spacing: .06em; color: var(--muted); }
  .lr-skills { display: grid; gap: 5px; }
  .lr-skill { display: grid; grid-template-columns: 74px 1fr 22px; gap: 8px; align-items: center; font-size: 13px; }
  .lr-skill .lbl { color: var(--muted); font: 500 14px var(--f-name); letter-spacing: .03em; }
  .lr-skill .bar { height: 7px; background: var(--panel); border-radius: 2px; position: relative; overflow: hidden; }
  .lr-skill .bar i { position: absolute; inset: 0 auto 0 0; border-radius: 2px; }
  .lr-skill .bar u { position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: var(--line); }
  .lr-skill .num { font: 600 13px var(--f-num); text-align: right; }
  .lr-vs { background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; display: grid; gap: 6px; }
  .lr-vs h3 { margin: 0; font: 8px var(--f-pix); letter-spacing: .1em; color: var(--muted); display: flex; justify-content: space-between; gap: 8px; }
  .lr-vs-row { display: grid; grid-template-columns: 44px 1fr 74px 1fr 44px; gap: 6px; align-items: center; font: 600 13px var(--f-num); }
  .lr-vs-row .lbl { text-align: center; color: var(--muted); font: 500 13px var(--f-name); }
  .lr-vs-row .r { text-align: right; }
  .lr-vs-row .bar { height: 6px; background: var(--panel); border-radius: 2px; position: relative; overflow: hidden; }
  .lr-vs-row .bar i { position: absolute; top: 0; bottom: 0; border-radius: 2px; }
  .lr-vs-row .bar.l i { right: 0; }
  .lr-vs-row .bar.r i { left: 0; }
  .lr-vs-row .up { color: var(--ball); }
  .lr-vs-note { font-size: 13px; color: var(--muted); margin: 4px 0 0; }
  .lr-legend { font-size: 13px; color: var(--muted); display: grid; gap: 3px; }
  .lr-legend b { color: var(--ink); font-weight: 500; }
  .lr-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  @media (prefers-reduced-motion: no-preference) { .lr-card { transition: border-color .15s, box-shadow .15s; } }
  @media (max-width: 480px) { .lr-skill { grid-template-columns: 64px 1fr 20px; } .lr-vs-row { grid-template-columns: 36px 1fr 62px 1fr 36px; } }`;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nice = P => P.first + " " + P.last.charAt(0) + P.last.slice(1).toLowerCase();
  const surname = P => P.last.charAt(0) + P.last.slice(1).toLowerCase();
  const handText = P => (P.hand === "left" ? "LEFT" : "RIGHT") + "-HANDED · " + (P.backhand === "one" ? "ONE" : "TWO") + "-HANDED BACKHAND";

  // A tiny pixel portrait in the player's colours and signature look (the Player Artist can replace it with real art).
  function sprite(P) {
    const art = window.PlayerArt && window.PlayerArt.portrait;
    if (art) { try { const c = art(P); if (c) { c.classList.add("lr-sprite"); return c; } } catch {} }
    const c = document.createElement("canvas"); c.width = 11; c.height = 16; c.className = "lr-sprite";
    c.setAttribute("aria-hidden", "true");
    const g = c.getContext("2d"), R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const look = (P.look && P.look.style) || "";
    R(3, 0, 5, 2, P.hair); R(3, 2, 5, 3, "#e1b48b"); R(2, 5, 7, 5, P.shirt); R(0, 5, 2, 4, "#e1b48b"); R(9, 5, 2, 4, "#e1b48b");
    R(3, 10, 5, 2, P.shorts); R(3, 12, 2, 3, "#e1b48b"); R(6, 12, 2, 3, "#e1b48b"); R(2, 15, 3, 1, "#f2f2f2"); R(6, 15, 3, 1, "#f2f2f2");
    if (look === "cap-curls") { R(2, 0, 7, 1, P.shirt); R(3, 1, 6, 1, P.shirt); R(2, 2, 1, 2, P.hair); R(8, 2, 1, 2, P.hair); }
    if (look === "long-band") { R(3, 1, 5, 1, P.look.band || "#f6f6f2"); R(2, 2, 1, 3, P.hair); R(8, 2, 1, 3, P.hair);
                                if (P.look.beard) R(3, 4, 5, 1, P.hair); }
    return c;
  }

  // Head to head: you against the pro you'd face (choosePlayers gives you the first other pro in the roster).
  function versus(you, opp, bodyStats) {
    const skills = window.SKILLS, a = window.getSkills(you.id), b = window.getSkills(opp.id);
    const ba = bodyStats(you), bb = bodyStats(opp);
    const rows = [
      { name: "Height", a: you.heightM, b: opp.heightM, max: 2.2, fmt: v => v.toFixed(2) },
      { name: "Weight", a: you.weightKg, b: opp.weightKg, max: 110, fmt: v => String(v), even: true },  // heavier is neither better nor worse
      { name: "Reach", a: ba.reach, b: bb.reach, max: 1.8, fmt: v => v.toFixed(2) },
      ...skills.map(s => ({ name: s.name, a: a[s.id], b: b[s.id], max: 20, fmt: v => String(v) })),
    ];
    const row = r => {
      const hi = r.even ? "" : r.a > r.b ? "a" : r.b > r.a ? "b" : "";
      return `<div class="lr-vs-row" role="row">
        <span role="cell" class="${hi === "a" ? "up" : ""}">${esc(r.fmt(r.a))}</span>
        <span class="bar l" aria-hidden="true"><i style="width:${Math.min(100, r.a / r.max * 100)}%;background:${you.shirt}"></i></span>
        <span role="rowheader" class="lbl">${esc(r.name)}</span>
        <span class="bar r" aria-hidden="true"><i style="width:${Math.min(100, r.b / r.max * 100)}%;background:${opp.shirt}"></i></span>
        <span role="cell" class="r ${hi === "b" ? "up" : ""}">${esc(r.fmt(r.b))}</span></div>`;
    };
    // The trade-off in words: height buys reach and stride, a lighter body is quicker off the mark.
    const notes = [];
    const tall = you.heightM >= opp.heightM ? you : opp, short = tall === you ? opp : you;
    const cm = Math.round(Math.abs(you.heightM - opp.heightM) * 100);
    if (cm > 0) notes.push(`${surname(tall)} is ${cm} cm taller: longer reach and stride, a steeper serve.`);
    const fast = ba.accel >= bb.accel ? you : opp;
    if (Math.abs(ba.accel - bb.accel) > 0.01) notes.push(`${surname(fast)} has the quicker first step from the body alone.`);
    if (cm > 0 && fast === tall) notes.push(`${surname(short)} has to win it with skill.`);
    return `<h3><span>${esc(nice(you).toUpperCase())}</span><span>VS</span><span>${esc(nice(opp).toUpperCase())}</span></h3>
      <div role="table" aria-label="${esc(nice(you))} compared with ${esc(nice(opp))}">${rows.map(row).join("")}</div>
      <p class="lr-vs-note">${esc(notes.join(" "))}</p>`;
  }

  function render(el, { roster, bodyStats, selected, onSelect }) {
    const skills = window.SKILLS;
    if (!roster.some(P => P.id === selected)) selected = roster[0] && roster[0].id;
    el.innerHTML = `<div class="lr">
      <div class="lr-wall" aria-hidden="true"></div>
      <div class="lr-cards" role="radiogroup" aria-label="Choose your player"></div>
      <section class="lr-vs" aria-live="polite" aria-label="Head to head"></section>
      <details class="lr-legend"><summary>What a skill point does</summary>
        ${skills.map(s => `<div><b>${esc(s.name)}</b>: ${esc(s.what)}. ${esc(s.step)} above 10.</div>`).join("")}
      </details></div>`;
    const wrap = el.querySelector(".lr-cards"), vs = el.querySelector(".lr-vs");
    const cards = [];

    function showVersus() {
      const you = roster.find(P => P.id === selected), opp = roster.find(P => P !== you);
      vs.hidden = !opp;
      if (opp) vs.innerHTML = versus(you, opp, bodyStats);
    }
    function pick(card, focus) {
      for (const c of cards) { const on = c === card; c.setAttribute("aria-checked", String(on)); c.tabIndex = on ? 0 : -1; }
      if (focus) card.focus();
      selected = card.dataset.id;
      showVersus();
      onSelect(selected);
    }

    for (const P of roster) {
      const sk = window.getSkills(P.id), body = bodyStats(P);
      const card = document.createElement("button");
      card.type = "button"; card.className = "lr-card"; card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", String(P.id === selected)); card.tabIndex = P.id === selected ? 0 : -1;
      card.dataset.id = P.id;
      card.setAttribute("aria-label", `${nice(P)}, ${P.code}, ${handText(P).toLowerCase()}, ${P.heightM.toFixed(2)} m, ${P.weightKg} kg, reach ${body.reach.toFixed(2)} m`);
      card.setAttribute("aria-describedby", "lr-sk-" + P.id);
      card.innerHTML = `<span class="lr-pick" aria-hidden="true">SELECTED</span>
        <div class="lr-top"><span class="slot"></span>
          <div class="lr-name">${esc(nice(P))}<small>${esc(P.code)} · ${esc(handText(P))}</small></div></div>
        <div class="lr-body">
          <div><b>${P.heightM.toFixed(2)}</b><span>HEIGHT M</span></div>
          <div><b>${P.weightKg}</b><span>WEIGHT KG</span></div>
          <div><b>${body.reach.toFixed(2)}</b><span>REACH M</span></div>
        </div>
        <div class="lr-skills" id="lr-sk-${esc(P.id)}">${skills.map(s => `
          <div class="lr-skill" title="${esc(s.what)} · ${esc(s.step)}">
            <span class="lbl">${esc(s.name)}</span>
            <span class="bar" aria-hidden="true"><u></u><i style="width:${sk[s.id] / 20 * 100}%;background:${P.shirt}"></i></span>
            <span class="num">${sk[s.id]}</span>
            <span class="lr-sr">(${esc(s.step)}).</span>
          </div>`).join("")}</div>`;
      card.querySelector(".slot").replaceWith(sprite(P));
      card.onclick = () => pick(card, false);
      // Radio group keys: arrows move and select, Home / End jump to the ends.
      card.onkeydown = e => {
        const i = cards.indexOf(card), n = cards.length;
        const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        pick(cards[(to + n) % n], true);
      };
      cards.push(card);
      wrap.appendChild(card);
    }
    showVersus();
  }

  window.Lockerroom = { render };
})();
