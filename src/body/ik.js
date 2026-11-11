/* BODY · IK (Body Animator). Solves one limb (hip → knee → ankle, shoulder → elbow → wrist) to reach a target.
   ENGINE: three.js CCDIKSolver (three@0.170.0, MIT, from jsdelivr, pinned): a real bone chain with a hinge
   at the knee / elbow ("limitation" axis) and that joint's flexion range as rotationMin / rotationMax.
   Why three.js (compared in agents/body-animator/LOG.md): it runs in the browser with no build step, works on
   plain Bone hierarchies (no mesh to draw), and has per-joint limits; cannon-es ragdolls would need tuned motors
   to keep a foot exactly on its plant.
   The library loads in the background, and only with ?body=skeleton or ?body=ccd (normal play downloads nothing
   and uses the exact solver). Until it has loaded (or if it can't, e.g. offline), and whenever a CCD
   answer misses the target or bends the wrong way, the exact two-bone solution below is used instead
   (law of cosines, same limits). Both return the same thing: { mid, end, flex, solver }. */
(function (root) {
  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/+esm";
  const CCD_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/animation/CCDIKSolver.js/+esm";
  const D2R = Math.PI / 180;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const len = a => Math.hypot(a.x, a.y, a.z);
  const scl = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const norm = a => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

  /* The limb's frame: dir = base → target, bend = the pole's part square to dir (where the knee / elbow points). */
  function frame(a, t, pole) {
    let d = sub(t, a), D = len(d);
    const dir = D > 1e-6 ? scl(d, 1 / D) : { x: 0, y: 0, z: -1 };
    let bend = sub(pole, scl(dir, dot(pole, dir)));
    if (len(bend) < 1e-6) bend = Math.abs(dir.z) < 0.9 ? cross(dir, { x: 0, y: 0, z: 1 }) : { x: 1, y: 0, z: 0 };
    return { D, dir, bend: norm(bend) };
  }
  /* Reachable distance from base to target with the middle joint inside 0 … flexMax degrees. */
  function reachRange(l1, l2, flexMax) {
    const inner = Math.PI - flexMax * D2R;                       // smallest inner angle allowed at the joint
    return { min: Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(inner)), max: (l1 + l2) * 0.9999 };
  }
  /* Exact two-bone IK. a = base joint, t = target, pole = which way the middle joint points. */
  function twoBone(a, t, l1, l2, pole, flexMax) {
    const { D, dir, bend } = frame(a, t, pole), R = reachRange(l1, l2, flexMax);
    const Dc = Math.max(R.min, Math.min(R.max, D));
    const cosA = Math.max(-1, Math.min(1, (l1 * l1 + Dc * Dc - l2 * l2) / (2 * l1 * Dc)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    const mid = add(add(a, dir, l1 * cosA), bend, l1 * sinA), end = add(a, dir, Dc);
    const flex = 180 - Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - Dc * Dc) / (2 * l1 * l2)))) / D2R;
    return { mid, end, flex, reached: Math.abs(D - Dc) < 1e-4, solver: "analytic" };
  }

  /* ---------- three.js CCDIKSolver ---------- */
  let ccd = null;                                    // { solve } once the library has loaded
  const stats = { ccd: 0, rejected: 0, analytic: 0 };
  function makeCCD(THREE, CCDIKSolver) {
    const base = new THREE.Bone(), mid = new THREE.Bone(), end = new THREE.Bone(), target = new THREE.Bone();
    base.name = "base"; mid.name = "mid"; end.name = "end"; target.name = "target";
    base.add(mid); mid.add(end);
    const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    mesh.add(base); mesh.add(target);
    mesh.bind(new THREE.Skeleton([base, mid, end, target]));
    const hinge = { index: 1, limitation: new THREE.Vector3(-1, 0, 0),   // the middle joint only folds one way (about −X)
                    rotationMin: new THREE.Vector3(-Math.PI, 0, 0), rotationMax: new THREE.Vector3(0, 0, 0) };
    const ik = { target: 3, effector: 2, links: [hinge, { index: 0 }], iteration: 12 };
    const solver = new CCDIKSolver(mesh, [ik]);
    const m = new THREE.Matrix4(), v = new THREE.Vector3(), P0 = 0.25;   // P0: start a little bent toward the pole
    function solve(a, t, l1, l2, pole, flexMax) {
      const { D, dir, bend } = frame(a, t, pole), R = reachRange(l1, l2, flexMax);
      const tc = add(a, dir, Math.max(R.min, Math.min(R.max, D)));      // a target the limb can reach
      const X = cross(dir, bend);                                        // bone axes: Y along the limb, Z toward the pole
      m.makeBasis(new THREE.Vector3(X.x, X.y, X.z), new THREE.Vector3(dir.x, dir.y, dir.z), new THREE.Vector3(bend.x, bend.y, bend.z));
      base.position.set(a.x, a.y, a.z);
      base.quaternion.setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), P0));
      mid.position.set(0, l1, 0); mid.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -2 * P0);
      end.position.set(0, l2, 0); end.quaternion.identity();
      target.position.set(tc.x, tc.y, tc.z); target.quaternion.identity();
      hinge.rotationMin.x = -flexMax * D2R;
      mesh.updateMatrixWorld(true);
      solver.update();
      const M = v.setFromMatrixPosition(mid.matrixWorld), mw = { x: M.x, y: M.y, z: M.z };
      const E = v.setFromMatrixPosition(end.matrixWorld), ew = { x: E.x, y: E.y, z: E.z };
      return { mid: mw, end: ew, target: tc };
    }
    return { solve };
  }
  /* Load three.js and its CCDIKSolver in the background. Tests (Node) can pass the modules in instead. */
  function load(mods) {
    if (ccd) return Promise.resolve(true);
    const got = mods ? Promise.resolve(mods)
      : Promise.all([import(THREE_URL), import(CCD_URL)]).then(([THREE, C]) => ({ THREE, CCDIKSolver: C.CCDIKSolver }));
    return got.then(({ THREE, CCDIKSolver }) => { ccd = makeCCD(THREE, CCDIKSolver); api.engine = "three@0.170.0 CCDIKSolver"; return true; })
      .catch(e => { console.warn("Body IK: three.js CCDIKSolver could not load, using the exact two-bone solver", e); return false; });
  }

  /* Solve one limb: the CCD answer when it is good (lands within 1 cm, bends toward the pole, inside the limits),
     otherwise the exact solution. */
  function solve(a, t, l1, l2, pole, flexMax) {
    const exact = twoBone(a, t, l1, l2, pole, flexMax);
    if (!ccd) { stats.analytic++; return exact; }
    try {
      const r = ccd.solve(a, t, l1, l2, pole, flexMax), { dir, bend } = frame(a, t, pole);
      const off = sub(r.mid, a), side = dot(sub(off, scl(dir, dot(off, dir))), bend);
      const flex = root.BodySkeleton ? root.BodySkeleton.flexion(a, r.mid, r.end) : exact.flex;
      if (len(sub(r.end, r.target)) < 0.01 && side >= 0 && flex <= flexMax + 0.5) {
        stats.ccd++;
        return { mid: r.mid, end: r.end, flex, reached: exact.reached, solver: "ccd" };
      }
    } catch (e) { /* fall through to the exact answer */ }
    stats.rejected++;
    return exact;
  }

  const api = { engine: "analytic two-bone", load, solve, twoBone, reachRange, stats, URLS: [THREE_URL, CCD_URL],
                v: { sub, add, dot, len, scl, cross, norm } };
  root.BodyIK = api;
})(typeof window !== "undefined" ? window : globalThis);
