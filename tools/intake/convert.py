"""Convert a video macOS can't decode (e.g. AV1 from a YouTube download) into H.264 the pose tools can read.

    tools/.venv/bin/python -I tools/intake/convert.py <in.mp4> <out.mp4> [maxHeight=1080]

Uses PyAV (FFmpeg's dav1d AV1 decoder) in the project's own environment (tools/.venv, git-ignored) and the Mac's
hardware H.264 encoder (h264_videotoolbox). Keeps the frame rate, scales down to maxHeight, drops audio.
"""
import sys, time
import av

src, dst = sys.argv[1], sys.argv[2]
max_h = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
inp = av.open(src)
vin = inp.streams.video[0]
vin.thread_type = "AUTO"
w, h = vin.codec_context.width, vin.codec_context.height
if h > max_h: w, h = round(w * max_h / h / 2) * 2, max_h
rate = vin.average_rate or 60
out = av.open(dst, "w")
vout = out.add_stream("h264_videotoolbox", rate=rate)
vout.width, vout.height, vout.pix_fmt = w, h, "yuv420p"
vout.bit_rate = 12_000_000
n, t0 = 0, time.time()
for frame in inp.decode(vin):
    for pkt in vout.encode(frame.reformat(width=w, height=h, format="yuv420p")): out.mux(pkt)
    n += 1
    if n % 1800 == 0: print(f"  {n} frames ({n / (time.time() - t0):.0f} fps)", flush=True)
for pkt in vout.encode(): out.mux(pkt)
out.close(); inp.close()
print(f"converted {n} frames to {w}x{h} H.264 in {time.time() - t0:.0f} s → {dst}")
