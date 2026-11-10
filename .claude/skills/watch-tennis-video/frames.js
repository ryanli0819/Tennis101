// Paste the whole file into javascript_tool on a youtube.com/watch page (built-in browser, pane closed).
// Nothing is downloaded or saved: frames are only drawn onto a canvas inside the page so Claude can look at them
// with a screenshot. Then call, one per javascript_tool call (keep each call under ~9 frames, or it can time out):
//   info()                                   → title, length, size, ad playing?
//   await sheet(range(0, 60, 6), 3)          → whole frames in a grid, labelled with their time: scan the video
//   await crops(range(39.2, 40.8, 0.2), fx, fy, fw, fh, 3)
//                                            → the same region (fractions of the frame) at full resolution, step by
//                                              step: a swing, a split step, a slide
(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const V = () => document.querySelector('#movie_player video') || document.querySelector('video');
  const set = (el, o) => Object.entries(o).forEach(([k, val]) => el.style.setProperty(k, val, 'important'));
  try { document.getElementById('movie_player').setPlaybackQualityRange('hd1080', 'hd1080'); } catch (e) {}
  V().muted = true; V().pause();

  let c = document.getElementById('cs');
  if (!c) { c = document.createElement('canvas'); c.id = 'cs'; document.body.appendChild(c); }
  set(c, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', 'z-index': '2147483647',
           background: '#000', 'object-fit': 'contain', visibility: 'visible' });
  const st = document.createElement('style');
  st.textContent = 'body>*:not(#cs){visibility:hidden!important} html,body{overflow:hidden!important;background:#000!important}';
  document.head.appendChild(st);
  const g = c.getContext('2d');
  const label = (t, x, y) => { g.font = 'bold 22px sans-serif'; g.fillStyle = '#ff0'; g.fillText(t.toFixed(2), x + 6, y + 24); };

  // Ads swap the <video> source mid-video: skip or run them to the end, then carry on.
  window.clearAds = async () => {
    for (let i = 0; i < 40 && document.querySelector('.ad-showing'); i++) {
      document.querySelector('.ytp-skip-ad-button,.ytp-ad-skip-button,.ytp-ad-skip-button-modern')?.click();
      const a = V(); if (a && isFinite(a.duration)) a.currentTime = a.duration;
      await sleep(500);
    }
    V().pause(); return !document.querySelector('.ad-showing');
  };
  window.seek = async t => {
    await clearAds(); const v = V(); v.pause();
    await new Promise(r => { const to = setTimeout(r, 8000);
      v.addEventListener('seeked', () => { clearTimeout(to); setTimeout(r, 250); }, { once: true }); v.currentTime = t; });
    if (document.querySelector('.ad-showing')) { await clearAds(); return seek(t); }
    return v;
  };
  window.info = () => { const v = V(); return { title: document.title, dur: v.duration, size: [v.videoWidth, v.videoHeight], ad: !!document.querySelector('.ad-showing') }; };
  window.range = (a, b, step) => { const out = []; for (let t = a; t <= b + 1e-6; t += step) out.push(+t.toFixed(2)); return out; };
  window.sheet = async (times, cols = 3) => {
    const cw = 640, ch = 360, rows = Math.ceil(times.length / cols);
    c.width = cw * cols; c.height = ch * rows; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < times.length; i++) {
      const v = await seek(times[i]), x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      g.drawImage(v, x, y, cw, ch); label(times[i], x, y);
    }
    return `sheet of ${times.length}`;
  };
  window.crops = async (times, fx, fy, fw, fh, cols = 3) => {
    const v0 = await seek(times[0]), W = v0.videoWidth, H = v0.videoHeight;
    const cw = Math.round(fw * W), ch = Math.round(fh * H), rows = Math.ceil(times.length / cols);
    c.width = cw * cols; c.height = ch * rows; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < times.length; i++) {
      const v = await seek(times[i]), x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      g.drawImage(v, fx * W, fy * H, cw, ch, x, y, cw, ch); label(times[i], x, y);
    }
    return `crops of ${times.length}`;
  };
  return info();
})();
