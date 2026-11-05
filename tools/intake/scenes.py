"""Split a compilation video into its shots (cuts between clips), and save one still per shot to label it.

    tools/.venv/bin/python -I tools/intake/scenes.py <video.mp4> <out.json> <stillsDir>

A cut = a big jump in the picture between two frames (mean absolute difference of small greyscale frames, well above
the recent average). Very short shots (< 0.6 s) are merged into their neighbour. Writes
{ "fps", "shots": [{ "from", "to", "t0", "t1" }] } and a contact sheet <stillsDir>/sheet.jpg with the shot numbers,
so a person (or Claude) can say which player each shot shows; then label it in the JSON ("player").
"""
import json, os, sys
import av, numpy as np
from PIL import Image, ImageDraw

src, out_json, still_dir = sys.argv[1:4]
os.makedirs(still_dir, exist_ok=True)
inp = av.open(src); v = inp.streams.video[0]; v.thread_type = "AUTO"
fps = float(v.average_rate or 60)
prev, diffs, mids = None, [], {}
for i, fr in enumerate(inp.decode(v)):
    g = np.asarray(fr.to_image().convert("L").resize((96, 54)), dtype=np.float32)
    diffs.append(0.0 if prev is None else float(np.abs(g - prev).mean())); prev = g
    if i % 30 == 0: mids[i] = fr.to_image().resize((320, 180))
inp.close()
d = np.array(diffs); n = len(d)
cuts = [0]
for i in range(1, n):
    local = np.median(d[max(0, i - 30):i]) if i > 1 else 0
    if d[i] > max(18.0, local * 4 + 6) and i - cuts[-1] >= int(0.6 * fps): cuts.append(i)
cuts.append(n)
shots = [{"from": a, "to": b - 1, "t0": round(a / fps, 2), "t1": round((b - 1) / fps, 2)} for a, b in zip(cuts, cuts[1:])]
# one still per shot: the sampled frame nearest its middle
cols, W, H = 6, 320, 180
rows = (len(shots) + cols - 1) // cols
sheet = Image.new("RGB", (cols * W, rows * (H + 16)), "black"); dr = ImageDraw.Draw(sheet)
for k, s in enumerate(shots):
    m = (s["from"] + s["to"]) // 2; key = min(mids, key=lambda j: abs(j - m))
    x, y = (k % cols) * W, (k // cols) * (H + 16)
    sheet.paste(mids[key], (x, y + 16)); dr.text((x + 3, y + 2), f"#{k}  {s['t0']}-{s['t1']}s", fill="yellow")
sheet.save(os.path.join(still_dir, "sheet.jpg"), quality=80)
json.dump({"source": os.path.basename(src), "fps": fps, "frames": n, "shots": shots}, open(out_json, "w"), indent=1)
print(f"{len(shots)} shots in {n} frames → {out_json}, sheet: {os.path.join(still_dir, 'sheet.jpg')}")
