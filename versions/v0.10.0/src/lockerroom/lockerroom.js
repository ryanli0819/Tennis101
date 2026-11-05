// =====================================================================
// LOCKER ROOM — pick your pro and see their body and skill points. Owner: Locker Room Designer
// (agents/locker-room-designer/). Reads players from the game's ROSTER and skills from src/skills/.
//
// Lockerroom.render(el, { roster, bodyStats, selected, onSelect(id) })
// =====================================================================
(function () {
  const css = `
  .lr { display: grid; gap: 14px; }
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
  .lr-legend { font-size: 13px; color: var(--muted); display: grid; gap: 3px; }
  .lr-legend b { color: var(--ink); font-weight: 500; }
  @media (max-width: 480px) { .lr-skill { grid-template-columns: 64px 1fr 20px; } }`;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // A tiny pixel portrait in the player's colours (the Player Artist can replace it with real art).
  function sprite(P) {
    const c = document.createElement("canvas"); c.width = 11; c.height = 16; c.className = "lr-sprite";
    const g = c.getContext("2d"), R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R(3, 0, 5, 2, P.hair); R(3, 2, 5, 3, "#e1b48b"); R(2, 5, 7, 5, P.shirt); R(0, 5, 2, 4, "#e1b48b"); R(9, 5, 2, 4, "#e1b48b");
    R(3, 10, 5, 2, P.shorts); R(3, 12, 2, 3, "#e1b48b"); R(6, 12, 2, 3, "#e1b48b"); R(2, 15, 3, 1, "#f2f2f2"); R(6, 15, 3, 1, "#f2f2f2");
    return c;
  }

  function render(el, { roster, bodyStats, selected, onSelect }) {
    const skills = window.SKILLS;
    el.innerHTML = `<div class="lr">
      <div class="lr-cards" role="radiogroup" aria-label="Choose your player"></div>
      <details class="lr-legend"><summary>What a skill point does</summary>
        ${skills.map(s => `<div><b>${esc(s.name)}</b>: ${esc(s.what)}. ${esc(s.step)} above 10.</div>`).join("")}
      </details></div>`;
    const wrap = el.querySelector(".lr-cards");
    for (const P of roster) {
      const sk = window.getSkills(P.id), body = bodyStats(P);
      const card = document.createElement("button");
      card.type = "button"; card.className = "lr-card"; card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", String(P.id === selected)); card.dataset.id = P.id;
      card.innerHTML = `<span class="lr-pick">SELECTED</span>
        <div class="lr-top"><span class="slot"></span>
          <div class="lr-name">${esc(P.first)} ${esc(P.last.charAt(0) + P.last.slice(1).toLowerCase())}<small>${esc(P.code)} · RIGHT-HANDED</small></div></div>
        <div class="lr-body">
          <div><b>${P.heightM.toFixed(2)}</b><span>HEIGHT M</span></div>
          <div><b>${P.weightKg}</b><span>WEIGHT KG</span></div>
          <div><b>${body.reach.toFixed(2)}</b><span>REACH M</span></div>
        </div>
        <div class="lr-skills">${skills.map(s => `
          <div class="lr-skill" title="${esc(s.what)} · ${esc(s.step)}">
            <span class="lbl">${esc(s.name)}</span>
            <span class="bar"><u></u><i style="width:${sk[s.id] / 20 * 100}%;background:${P.shirt}"></i></span>
            <span class="num">${sk[s.id]}</span>
          </div>`).join("")}</div>`;
      card.querySelector(".slot").replaceWith(sprite(P));
      card.onclick = () => {
        wrap.querySelectorAll(".lr-card").forEach(c => c.setAttribute("aria-checked", String(c === card)));
        onSelect(P.id);
      };
      wrap.appendChild(card);
    }
  }

  window.Lockerroom = { render };
})();
