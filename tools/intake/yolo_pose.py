"""YOLO POSE: a second, independent body tracker for a clip (Ryan, Nov 27: "can you use a yolo model on that?").

    tools/.venv/bin/python -I tools/intake/yolo_pose.py <clip.mov> [vision.keypoints.json]

Runs Ultralytics YOLO11m-pose (tools/models/yolo11m-pose.pt, AGPL-3.0; an offline analysis tool only, nothing of it
ships in the game) on every frame and writes <clip>.yolo.keypoints.json next to the clip, in the same layout as the
Apple Vision files: {"width", "height", "fps", "coords", "frames": [{"i", "t", "joints": {name: [x, y, conf]}, "box"}]},
x and y normalised 0..1 from the top-left. Only numbers are written; no picture leaves the clip.

Which person is the server: if the Vision keypoints file is given (or found next to the clip), the YOLO person whose
joints sit closest to Vision's server on that frame; otherwise the biggest person on the first frame, then the one
whose box stays closest to the last one (ball kids and line judges are smaller and elsewhere).
Telemetry is off (yolo settings sync=False).
"""
import json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL = os.path.join(ROOT, "tools/models/yolo11m-pose.pt")
COCO = ["nose", "leftEye", "rightEye", "leftEar", "rightEar", "leftShoulder", "rightShoulder", "leftElbow", "rightElbow",
        "leftWrist", "rightWrist", "leftHip", "rightHip", "leftKnee", "rightKnee", "leftAnkle", "rightAnkle"]


def main():
    clip = sys.argv[1]
    base = os.path.splitext(clip)[0].replace(" ", "-")
    out = base + ".yolo.keypoints.json"
    vis_path = sys.argv[2] if len(sys.argv) > 2 else base + ".keypoints.json"
    vision = {}
    if os.path.exists(vis_path):
        for f in json.load(open(vis_path)).get("frames", []):
            if f.get("joints"): vision[f["i"]] = f["joints"]
    from ultralytics import YOLO
    import cv2
    cap = cv2.VideoCapture(clip); fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)); cap.release()
    model = YOLO(MODEL)
    frames, last_box = [], None
    for i, r in enumerate(model.predict(source=clip, stream=True, device="mps", verbose=False, conf=0.25)):
        people = []
        if r.keypoints is not None and len(r.keypoints):
            xy, cf, bx = r.keypoints.xyn.cpu().numpy(), r.keypoints.conf.cpu().numpy(), r.boxes.xyxyn.cpu().numpy()
            for k in range(len(xy)):
                people.append(({n: [round(float(xy[k][j][0]), 4), round(float(xy[k][j][1]), 4), round(float(cf[k][j]), 3)]
                                for j, n in enumerate(COCO) if cf[k][j] > 0.05}, [round(float(v), 4) for v in bx[k]]))
        pick = None
        if people:
            v = vision.get(i)
            if v:   # closest to Vision's server
                def gap(p):
                    d = [math.dist(p[0][n][:2], v[n][:2]) for n in p[0] if n in v]
                    return sum(d) / len(d) if d else 9
                pick = min(people, key=gap)
            elif last_box is None:
                pick = max(people, key=lambda p: (p[1][2] - p[1][0]) * (p[1][3] - p[1][1]))
            else:
                c0 = ((last_box[0] + last_box[2]) / 2, (last_box[1] + last_box[3]) / 2)
                pick = min(people, key=lambda p: math.dist(c0, ((p[1][0] + p[1][2]) / 2, (p[1][1] + p[1][3]) / 2)))
            last_box = pick[1]
        frames.append({"i": i, "t": round(i / fps, 4), "joints": pick[0] if pick else {}, "box": pick[1] if pick else None})
    json.dump({"source": os.path.basename(clip), "tracker": "ultralytics yolo11m-pose", "width": W, "height": H, "fps": fps,
               "coords": "x,y normalized 0..1 from top-left of the video frame; third value = confidence",
               "frames": frames}, open(out, "w"), separators=(",", ":"))
    found = sum(1 for f in frames if f["joints"])
    print(f"{os.path.basename(clip)}: {len(frames)} frames, server found on {found} → {os.path.relpath(out, ROOT)}")


if __name__ == "__main__":
    main()
