// The whole film as one three.js scene with two sets: the water town (canal, arch bridge, houses, the square with
// the pillars, the fortune teller's stall, the gears) and the ancestral hall. update(id, f, camera) poses everything
// for shot `id` at frame f (a pure function of id + f): camera, camera-relative sun, sky, fog, river, props, cast.
import * as THREE from "three";
import { Batch, V, lam, Ray, setSight, Kit, boxGeo } from "./build";
import { ctex } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, CATGEO } from "./cast";
import { cloudHD, waterNear, waterFar } from "./paint";
import { buildTown, buildHall, buildStall, abacus, boat, slipTex, plaqueTex, plaqueGlow, gearGeo, bowlGeo, M, woodTex } from "./jn";
import {
  FPS, D0, SHOTS, camAt, V3, smooth, clamp01, pop, deckY, EV, SQ, PILLAR_X, PILLAR_H, STALL, ABACUS, SLIPS, RM, ALTAR, BOWL0, BOWL_TIP, BOWL_HIT, HER, HIS, ShotDef,
} from "./story";

export const loadKit = () => Promise.resolve({} as Kit);

/** every lens position of the town shots looking at its subject (houses on these lines are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) {
    if (s.set !== "town") continue;
    for (let f = s.a - 6; f < s.b + 6; f += 3) {
      const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
      const fw = look.clone().sub(o), len = fw.length();
      fw.normalize();
      const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
      const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
      for (const [sx, sy] of [[0, 0], [-0.7, 0], [0.7, 0], [0, 0.7], [0, -0.5], [-0.6, 0.6], [0.6, 0.6]])
        out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
    }
  }
  return out;
};
const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
const smokeTex = () => ctex("incense", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(235,235,240,0.75)"); gr.addColorStop(1, "rgba(235,235,240,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
/** emissive "glow" copy of a slip: white characters on black */
const slipGlowTex = (key: string, pillars: string[]) => ctex("slipGlow_" + key, 512, 768, (g) => {
  g.fillStyle = "#000"; g.fillRect(0, 0, 512, 768);
  g.font = `96px "AR PL UKai CN", "Noto Sans CJK SC", serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff";
  pillars.forEach((p, i) => { const x = 512 - 44 - (424 / 4) * (i + 0.5); g.fillText(p[0], x, 250); g.fillText(p[1], x, 520); });
});
const slipMats = (key: string, pillars: string[]) => {
  const top = twoTone(new THREE.MeshLambertMaterial({ map: slipTex(key, pillars), emissive: new THREE.Color("#ffc94a"), emissiveMap: slipGlowTex(key, pillars), emissiveIntensity: 0 }));
  const red = lam("slipEdge", () => ({ color: "#b22a28" }));
  return { top, red, arr: [red, red, top, red, red, red] as THREE.Material[] };
};

type Pillar = { g: THREE.Group; stem: THREE.MeshLambertMaterial; branch: THREE.MeshLambertMaterial };

export class World {
  root = new THREE.Group();
  private town = new THREE.Group(); private hall = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = []; private cats: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private WU: Record<string, THREE.IUniform>;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
  // dynamic props
  private hookSlip: THREE.Mesh; private heroSlip: THREE.Mesh; private heroTop: THREE.MeshLambertMaterial;
  private pillars: Pillar[] = []; private pillarRoot = new THREE.Group();
  private stall = new THREE.Group(); private ab: ReturnType<typeof abacus>;
  private gears = new THREE.Group(); private gearA: THREE.Mesh; private gearB: THREE.Mesh;
  private boatA: THREE.Group; private altarSlip: THREE.Mesh; private bowl: THREE.Mesh;
  private smoke: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; k: number }[] = [];

  constructor(_kit: Kit) {
    const R = this.root;
    R.add(this.town, this.hall);
    // ---- sky + light (template) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true, transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }
    // ---- the water town ----
    setSight(sightLines());
    buildTown(this.town);
    setSight([]);
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
    };
    const waterM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    waterM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", WATER_DECL)
        .replace("#include <map_fragment>", WATER_COL)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
    };
    waterM.customProgramCacheKey = () => "canal1";
    const wg = new THREE.PlaneGeometry(800, 12); wg.rotateX(-Math.PI / 2);
    const wm = new THREE.Mesh(wg, waterM); wm.receiveShadow = true; this.town.add(wm);
    this.boatA = boat(); this.town.add(this.boatA);
    const moored = boat(); moored.position.set(16, 0.02, -4.6); moored.rotation.y = 0.08; this.town.add(moored);
    // the giant slip of the hook and the hero slip of the insert
    const her = slipMats("her", HER);
    this.hookSlip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.03, 2.4), her.arr); this.hookSlip.castShadow = true; this.hookSlip.receiveShadow = true;
    const hero = slipMats("hero", HER);
    this.heroTop = new THREE.MeshBasicMaterial({ map: slipTex("her", HER), color: new THREE.Color(1.05, 1.05, 1.05) }) as unknown as THREE.MeshLambertMaterial; // unlit insert: reads red, never in shade
    this.heroSlip = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.93), [hero.red, hero.red, this.heroTop, hero.red, hero.red, hero.red]);
    this.town.add(this.hookSlip, this.heroSlip);
    // ---- the square: four pillars, stall, gears ----
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Group();
      g.add(meshOf(new THREE.CylinderGeometry(0.36, 0.38, PILLAR_H, 28).translate(0, PILLAR_H / 2, 0), M.lacquer()));
      g.add(meshOf(new THREE.CylinderGeometry(0.55, 0.6, 0.28, 24).translate(0, 0.14, 0), M.stone()));
      for (const y of [0.42, PILLAR_H - 0.12]) g.add(meshOf(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 28).translate(0, y, 0), M.gold()));
      g.add(meshOf(new THREE.CylinderGeometry(0.46, 0.4, 0.16, 28).translate(0, PILLAR_H + 0.04, 0), M.gold()));
      const plaque = (ch: string, y: number) => {
        const mat = twoTone(new THREE.MeshLambertMaterial({ map: plaqueTex(ch), emissive: new THREE.Color("#ffc94a"), emissiveMap: plaqueGlow(ch), emissiveIntensity: 0 }));
        g.add(meshOf(new THREE.CylinderGeometry(0.385, 0.385, 0.66, 18, 1, true, Math.PI - 0.62, 1.24).translate(0, y, 0), mat));
        return mat;
      };
      const stem = plaque(HER[k][0], 2.62), branch = plaque(HER[k][1], 1.5);
      g.position.set(PILLAR_X[k], D0, SQ[2]);
      this.pillarRoot.add(g); this.pillars.push({ g, stem, branch });
    }
    this.town.add(this.pillarRoot);
    buildStall(this.stall, STALL);
    this.ab = abacus(ABACUS); this.stall.add(this.ab.g);
    const slipsT = [slipMats("tblHis", HIS), slipMats("tblHer", HER)];
    SLIPS.forEach((p, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.006, 0.42), slipsT[i].arr); m.position.set(...p); m.rotation.y = Math.PI + (i ? -0.05 : 0.06); m.receiveShadow = true; this.stall.add(m); });
    this.town.add(this.stall);
    const gg = gearGeo(), gm = lam("gearWood", () => ({ map: woodTex("gear", "#b98552") }));
    this.gearA = meshOf(gg, gm); this.gearB = meshOf(gg, lam("gearRed", () => ({ map: woodTex("gearR", "#b0503a") }))); // his (pale wood) and hers (cinnabar)
    const post = new Batch();
    post.add(boxGeo(V(-0.22, 0, 0.55), V(0.22, 6.3, 0.85)), M.wood());
    post.add(boxGeo(V(-1.0, 0, 0.5), V(1.0, 0.3, 0.9)), M.stone());
    for (const y of [1.6, 4.5]) post.add(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 12).rotateX(Math.PI / 2).translate(0, y, 0.25), M.wood());
    post.build(this.gears);
    this.gears.add(this.gearA, this.gearB);
    this.gears.position.set(SQ[0], D0, SQ[2]);
    this.town.add(this.gears);
    // ---- the ancestral hall ----
    buildHall(this.hall, RM);
    const alt = slipMats("altar", HER);
    this.altarSlip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.006, 0.42), alt.arr);
    this.altarSlip.position.set(ALTAR[0] + 0.32, 0.946, ALTAR[2] - 0.16); this.altarSlip.rotation.y = Math.PI + 0.12;
    this.bowl = meshOf(bowlGeo(), M.porcelain());
    this.hall.add(this.altarSlip, this.bowl);
    const st = smokeTex();
    for (let k = 0; k < 6; k++) {
      const mat = new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0.5 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.layers.set(NOINK);
      this.smoke.push({ m, mat, k: k / 6 }); this.hall.add(m);
    }
  }

  /** camera-relative sun, frozen per shot */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private cat(i: number) { while (this.cats.length <= i) this.cats.push(new Actor(this.root, CATGEO)); return this.cats[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.05; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    this.town.visible = s.set === "town"; this.hall.visible = s.set === "hall";
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 5, 6, 70);
    if (s.light === "golden") Rr = Math.max(Rr, 22);
    this.sun.position.copy(focus).addScaledVector(sunDir, 160); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 360; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z); mat.map = this.cloudMaps[s.light][i % 4];
    }
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;
    // ---- props ----
    this.poseProps(id, f, t);
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0), up = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 1);
    const st = stage(id, f, { pos: cam.position, right, up, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0, ci = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5 * sc2 + 0.3))) continue;
      const a = p.geo === "cat" ? this.cat(ci++) : this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    for (let i = ci; i < this.cats.length; i++) this.cats[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e3 of fused) e3.bind();
    return focus;
  }

  private poseProps(id: number, f: number, t: number) {
    // boat drifting down the canal
    this.boatA.position.set(-14 + 0.45 * t, 0.02 + 0.02 * Math.sin(t * 1.3), 2.0); this.boatA.rotation.set(0.01 * Math.sin(t * 1.1), 0, 0.012 * Math.sin(t * 0.9));
    // ---- hook: the giant slip falls onto the bridge crown on "否" ----
    this.hookSlip.visible = id === 1 && f >= EV.slipFall;
    if (this.hookSlip.visible) {
      const u = clamp01((f - EV.slipFall) / (EV.slipLand - EV.slipFall)), fall = u * u, yLand = deckY(0) + 0.03;
      const flutter = (1 - u) * 0.9;
      this.hookSlip.position.set(0.15 + 1.6 * Math.sin(u * 5.0) * (1 - u), yLand + 22 * (1 - fall), 0.2 + 0.8 * Math.cos(u * 4.0) * (1 - u));
      this.hookSlip.rotation.set(flutter * Math.sin(u * 9), Math.PI + 0.2 + 2.4 * (1 - u), flutter * Math.cos(u * 7));
      if (f >= EV.slipLand) { this.hookSlip.position.set(0.15, yLand, 0.2); this.hookSlip.rotation.set(0, Math.PI + 0.2, 0); }
    }
    // ---- insert: the slip opens (unfolds) and its eight characters light up ----
    this.heroSlip.visible = id === 2 && f >= EV.slipOpen - 1;
    if (this.heroSlip.visible) {
      const k = pop(f, EV.slipOpen, 10);
      this.heroSlip.position.set(0, 5.32 + 0.02 * Math.sin(t * 2), 2.0);
      this.heroSlip.rotation.set(-Math.PI / 2 + 0.08, Math.PI, 0.02 * Math.sin(t * 1.5)); // stood up, top face toward the lens (-z), text upright
      this.heroSlip.scale.set(Math.max(0.02, k), 1, 1);
      (this.heroTop as unknown as THREE.MeshBasicMaterial).color.setScalar(1.05 + 0.75 * smooth((f - EV.slipOpen - 6) / 30)); // gold lights up into the bloom
    }
    // ---- pillars: rise one per word, stems / branches light up, the day branch glows, the clash tilts them ----
    this.pillarRoot.visible = id === 3 || id === 5 || id === 6 || id === 7;
    this.pillars.forEach((p, k) => {
      let y = 0;
      if (id === 3) { const u = pop(f, EV.rise[k], 10); y = -(PILLAR_H + 0.4) * (1 - u); }
      p.g.position.y = D0 + y;
      let tilt = 0;
      if ((id === 6 && f >= EV.chong) || id === 7) tilt = (k === 1 ? 0.07 : k === 2 ? -0.07 : k === 0 ? 0.025 : -0.025) * (id === 7 ? 1 : smooth((f - EV.chong) / 6));
      p.g.rotation.z = -tilt;
      let gs = 0, gb = 0;
      if (id === 3) {
        const pulse = (f0: number) => (f < f0 ? 0 : 0.5 + 2.4 * Math.exp(-(f - f0) / 14));
        gs = pulse(EV.stems + k * 2); gb = pulse(EV.branches + k * 2);
        if (f >= EV.eight) { const pe = 1.0 + 2.2 * Math.exp(-(f - EV.eight) / 16); gs = Math.max(gs, pe); gb = Math.max(gb, pe); }
      }
      if (id === 5 && k === 2 && f >= EV.dayBranch) gb = 1.0 + 1.6 * (0.5 + 0.5 * Math.sin((f - EV.dayBranch) / 4));
      p.stem.emissiveIntensity = gs; p.branch.emissiveIntensity = gb;
    });
    // ---- stall + abacus ----
    this.stall.visible = id >= 5 && id <= 7;
    this.ab.beads.forEach((row, r) => row.forEach((m, j) => {
      let up = 0;
      if (id >= 6 && r === 3 && j === 1) up = smooth((f - EV.bead1) / 3);
      if (id >= 6 && r === 4 && j === 2) up = smooth((f - EV.bead2) / 3);
      if (id === 6 && r === 2 && j < 2) up = 1;
      m.position.z = this.ab.rest(j, id === 7 ? (r === 3 && j === 1) || (r === 4 && j === 2) ? 1 : 0 : up);
    }));
    // ---- gears: rise, mesh, jam ----
    this.gears.visible = id === 9;
    if (id === 9) {
      const k = pop(f, EV.gearsUp, 12);
      this.gears.scale.setScalar(Math.max(0.01, k));
      const fj = Math.min(f, EV.jam), rate = (ff: number) => 0.25 + 0.85 * smooth((ff - EV.mesh) / 20);
      let th = 0; for (let ff = 1495; ff < fj; ff++) th += rate(ff) / FPS;
      const jam = smooth((f - EV.jam) / 6);
      const shake = [EV.jam + 8, EV.ka1, EV.ka2].reduce((a, f0) => { const n = f - f0; return n >= 0 && n < 7 ? a + 0.035 * (n % 2 ? -1 : 1) * (1 - n / 7) : a; }, 0);
      this.gearA.position.set(0, 1.6, 0); this.gearA.rotation.set(0, 0, th + shake);
      this.gearB.position.set(0, 1.6 + 2.9 + 0.2 * jam, 0); this.gearB.rotation.set(0, 0, -th + Math.PI / 12 * (1 - jam) - shake);
    }
    // ---- hall: the slip on the altar, incense smoke, the bowl ----
    this.altarSlip.visible = (id === 4 && f >= EV.place + 4) || id === 11;
    for (const sm of this.smoke) {
      const u = (t * 0.16 + sm.k) % 1, sz = 0.12 + u * 0.5;
      sm.m.position.set(ALTAR[0] + 0.05 * Math.sin(u * 6 + sm.k * 9), 1.25 + u * 1.4, ALTAR[2] - 0.12);
      sm.m.scale.set(sz, sz, 1); sm.mat.opacity = 0.45 * (1 - u) * Math.min(1, u * 6);
    }
    let bx = BOWL0[0], by = BOWL0[1], rz = 0, vis = true;
    if (id === 11 && f >= EV.push) {
      bx += 0.34 * smooth((f - EV.push) / (BOWL_TIP - EV.push));
      if (f >= BOWL_TIP) {
        const tt = (f - BOWL_TIP) / FPS, T0 = (BOWL_HIT - BOWL_TIP) / FPS;
        by = BOWL0[1] - (BOWL0[1] - 0.0) * Math.min(1, (tt / T0) ** 2); bx += 0.35 * Math.min(tt, T0); rz = -4.2 * Math.min(tt, T0);
      }
      vis = f < BOWL_HIT;
    }
    this.bowl.visible = vis; this.bowl.position.set(bx, by, BOWL0[2]); this.bowl.rotation.set(0, 0, rz);
  }
}

const meshOf = (g: THREE.BufferGeometry, m: THREE.Material) => { const x = new THREE.Mesh(g, m); x.castShadow = true; x.receiveShadow = true; return x; };

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.25 * wTime, 0.0);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;
export { RM };
