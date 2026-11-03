// Our Qing cast as lit flat cards in the 3D world (template machinery: canvas pool, yaw billboards shaded by cardShade,
// contact blobs, blinks) staged per shot of the bazi short: the young pair, the matchmaker, the household and the
// cat, the fortune teller, zodiac townsfolk and figurines, a procession of matchmakers, plus the story effects.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, fxHeart, fxBolt, fxCrack, fxStorm, fxDust, fxSnort, fxShards, catDraw,
  Outfit, Expr, FrontOpts, SideOpts, MATCHMAKER, FATHER, MOTHER, TELLER, GROOM, BRIDE, DYNASTY, ZODIAC, zodiacOutfit, Animal, INK,
} from "./toon";
import {
  FPS, D0, SHOTS, V3, smooth, clamp01, pop, deckY, EV, SQ, ringPos, LIUHE, CHONG, HAI, SLIPS, CAT_AT, BOWL_HIT, PILLAR_X, ABACUS,
} from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "cat"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const SWAPS: Record<number, number[]> = {};
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- staging ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };
/** cat card: 600 x 600 design (base line 575), 0.62 m wide */
export const CAT_SIZE = 0.62;
export const CATGEO = (() => { const g = new THREE.PlaneGeometry(CAT_SIZE, CAT_SIZE); g.translate(0, CAT_SIZE * (0.5 - 25 / 600), 0); return g; })();

const W = (i: number, o: Outfit, key: string): Who => ({ i, o, okey: key });
const front = (cam: CamInfo, who: Who, x: number, y: number, z: number, fo: FrontOpts, scale = 1, out?: Stage, shadow = true) => {
  const pl = person(cam, who, x, y, z, { side: false, mirror: false }, fo, {}, scale);
  if (out) { out.places.push(pl); if (shadow) blob(out, x, y, z, scale); }
  return pl;
};
/** a camera-facing effect card spanning world points a -> b (rotated in screen space), height = width x aspect */
const span = (out: Stage, cam: CamInfo, key: string, cw: number, ch: number, draw: (p: Pen) => void, a: V3, b: V3, aspect: number) => {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const sx = d.dot(cam.right), sy = d.dot(cam.up), w = Math.hypot(sx, sy);
  out.fx.push({ key, cw, ch, draw, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2, w, h: w * aspect, rot: Math.atan2(sy, sx) });
};
const burst = (out: Stage, f: number, f0: number, n: number, x: number, y: number, z: number, s: number, col = "#fff3b0") => {
  if (f < f0 || f >= f0 + n) return;
  const u = q((f - f0) / n, 30);
  out.fx.push({ key: `burst${col}${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u, col), x, y, z, w: s, h: s });
};
const dust = (out: Stage, f: number, f0: number, n: number, x: number, y: number, z: number, s: number, col?: string) => {
  if (f < f0 || f >= f0 + n) return;
  const u = q((f - f0) / n, 30);
  out.fx.push({ key: `dust${col}${u}`, cw: 300, ch: 300, draw: (p) => fxDust(p, u, col), x, y, z, w: s, h: s, soft: true });
};
const exprAt = (f: number, list: [number, Expr][]): Expr => { let e = list[0][1]; for (const [f0, x] of list) if (f >= f0) e = x; return e; };

/** zodiac townsfolk (full size or figurines) */
const zodiac = (cam: CamInfo, out: Stage, k: Animal, i: number, x: number, y: number, z: number, t: number, fo: FrontOpts, scale = 1, shadow = true) =>
  front(cam, W(300 + i, zodiacOutfit(k), "z" + k), x, y, z, { blink: lidAt(t, 300 + i), ...fo }, scale, out, shadow);

const sceneHook = (cam: CamInfo, f: number, t: number, out: Stage) => {
  const shock = f >= EV.slipLand;
  front(cam, W(1, GROOM, "groom"), 0.45, deckY(-4.8), -4.8, { mode: "stand", expr: shock ? "shock" : "neutral", look: shock ? 0 : -1, blink: lidAt(t, 1), seed: 3 }, 1, out);
  front(cam, W(2, BRIDE, "bride"), -0.4, deckY(3.8), 3.8, { mode: "stand", expr: shock ? "shock" : "smile_closed", look: 0, blink: lidAt(t, 2), seed: 4 }, 1, out);
  dust(out, f, EV.slipLand, 14, 0, deckY(0) + 0.3, -0.3, 3.0, "235,225,205");
};
const sceneMatchmaker = (cam: CamInfo, f: number, t: number, out: Stage) => {
  if (f >= EV.slipOpen) return;
  const z = Math.min(3.0, -1.0 + 0.063 * (f - 186)), walking = z < 3.0;
  const ph = q((((f - 186) / FPS) * 2.0) % 1, 60);
  front(cam, W(5, MATCHMAKER, "mm"), 0.15, deckY(z), z, { mode: walking ? "stroll" : "stand", phase: ph, expr: f > 236 ? "grin" : "smile", prop: "slip", blink: lidAt(t, 5), seed: 6 }, 1, out);
};
const sceneHall = (id: number, cam: CamInfo, f: number, t: number, out: Stage) => {
  if (id === 4) {
    const placed = f >= EV.place, bowK = smooth((f - EV.bow) / 6) * (1 - smooth((f - EV.bow - 26) / 8));
    if (f < 590) front(cam, W(10, FATHER, "father"), 200.6, 0, 1.85, { mode: "stand", facing: -1, expr: "stern", prop: placed ? null : "slip", tilt: -24 * bowK, headTilt: -10 * bowK, blink: lidAt(t, 10), seed: 8 }, 1, out);
    else if (f < 642) {
      front(cam, W(10, FATHER, "father"), 200.1, 0, 0.9, { mode: "stand", expr: "nervous", look: 1, blink: lidAt(t, 10), seed: 8 }, 1, out);
      const xm = 199.6 + 0.55 * clamp01((f - 590) / 50), ph = q((((f - 590) / FPS) * 1.4) % 1, 60);
      front(cam, W(11, MOTHER, "mother"), xm, 0.04 * Math.max(0, Math.sin(ph * Math.PI * 4)), 0.4, { mode: "stroll", phase: ph, lift: 30, expr: "nervous", blink: lidAt(t, 11), seed: 9 }, 1, out);
    } else front(cam, W(10, FATHER, "father"), 198.35, 0, 1.0, { mode: "stand", expr: "stern", look: 1, blink: lidAt(t, 10), seed: 8 }, 1, out);
  } else {
    if (f < 1882) {
      front(cam, W(10, FATHER, "father"), 198.95, 0, 1.0, { mode: "stand", expr: "neutral", blink: lidAt(t, 10), seed: 8 }, 1, out);
      front(cam, W(11, MOTHER, "mother"), 199.5, 0, 1.45, { mode: "stand", expr: "smile_closed", blink: lidAt(t, 11), seed: 9 }, 1, out);
    }
  }
  // the cat on the cupboard
  let paw = 0, look = -1, lid = lidAt(t, 20), tail = 0.5 + 0.5 * Math.sin(t * 2.2);
  if (id === 11) {
    if (f >= EV.catLook && f < EV.catPaw) look = 1;
    if (f >= EV.catLook && f < EV.catLook + 4) lid = [0.5, 1, 1, 0.5][f - EV.catLook];
    if (f >= EV.catPaw) paw = 0.32 * smooth((f - EV.catPaw) / 24);
    if (f >= EV.push) paw = 0.32 + 0.68 * smooth((f - EV.push) / 10);
    if (f >= EV.push + 30) paw = 1 - 0.7 * smooth((f - EV.push - 30) / 12);
    if (f >= BOWL_HIT) { look = 1; const k = f - BOWL_HIT - 10; lid = k >= 0 && k < 4 ? [0.5, 1, 1, 0.5][k] : 0; }
  }
  const light = light2D(cam, false);
  out.places.push({ key: `cat|${q(paw, 40)}|${look}|${lid}|${q(tail, 10)}|${q(light)}`, geo: "cat", x: CAT_AT[0], y: CAT_AT[1], z: CAT_AT[2],
    draw: (p) => catDraw(p, paw, look, lid, light, tail), size: [900, 900, 1.5] });
  if (id === 11) {
    if (f >= BOWL_HIT && f < BOWL_HIT + 14) {
      const u = q((f - BOWL_HIT) / 14, 30);
      out.fx.push({ key: `shards${u}`, cw: 400, ch: 300, draw: (p) => fxShards(p, u), x: 197.95, y: 0.28, z: 2.3, w: 1.1, h: 0.82 });
    }
    dust(out, f, BOWL_HIT, 12, 197.95, 0.12, 2.3, 0.7, "240,240,248");
  }
};
const teller = (cam: CamInfo, out: Stage, t: number, fo: FrontOpts) =>
  front(cam, W(30, TELLER, "teller"), 24.0, D0, 16.0, { mode: "stand", blink: lidAt(t, 30), seed: 12, ...fo }, 1, out);
const figurines = (cam: CamInfo, out: Stage, f: number, t: number) => {
  const sc = 0.24, pH = pop(f, EV.figs, 9), pR = pop(f, EV.figs + 4, 9);
  const hopH = f >= EV.horse && f < EV.horse + 8 ? 0.05 * Math.sin(((f - EV.horse) / 8) * Math.PI) : 0;
  const hopR = f >= EV.rat && f < EV.rat + 8 ? 0.05 * Math.sin(((f - EV.rat) / 8) * Math.PI) : 0;
  const glare = f >= EV.chong - 30;
  if (pH > 0.01) zodiac(cam, out, "horse", 0, SLIPS[0][0], SLIPS[0][1] + 0.012 + hopH, SLIPS[0][2], t, { mode: "stand", expr: glare ? "stern" : "smile", facing: glare ? -1 : 0 }, sc * pH, true);
  if (pR > 0.01) zodiac(cam, out, "rat", 1, SLIPS[1][0], SLIPS[1][1] + 0.012 + hopR, SLIPS[1][2], t, { mode: "stand", expr: glare ? "stern" : "smile", facing: glare ? 1 : 0 }, sc * pR, true);
};
const sceneStall = (id: number, cam: CamInfo, f: number, t: number, out: Stage) => {
  if (id === 5) {
    teller(cam, out, t, { expr: f < 757 ? "smile" : "neutral" });
    figurines(cam, out, f, t);
  } else if (id === 6) {
    teller(cam, out, t, { expr: f >= EV.chong ? "shock" : "stern" });
    figurines(cam, out, f, t);
    burst(out, f, EV.bead1, 5, ABACUS[0] - 0.02, ABACUS[1] + 0.05, ABACUS[2] - 0.05, 0.14);
    burst(out, f, EV.bead2, 5, ABACUS[0] + 0.03, ABACUS[1] + 0.05, ABACUS[2] + 0.02, 0.14);
    if (f >= EV.chong) {
      const u = q(clamp01((f - EV.chong) / 10), 30);
      out.fx.push({ key: `crack${u}`, cw: 500, ch: 500, draw: (p) => fxCrack(p, u), x: SQ[0], y: D0 + 1.9, z: SQ[2] - 0.5, w: 3.2, h: 3.4 });
      burst(out, f, EV.chong, 8, SQ[0], D0 + 2.4, SQ[2] - 0.6, 2.6, "#ffe066");
    }
  } else if (id === 7) {
    if (f < 1073) {
      const k = smooth((f - EV.dodge) / 30), phs = q((((f - EV.dodge) / FPS) * 1.6) % 1, 60), moving = f > EV.dodge && f < EV.dodge + 30;
      zodiac(cam, out, "horse", 0, SQ[0] - 0.45 - 1.4 * k, D0, 19.5, t, { mode: moving ? "stroll" : "stand", phase: phs, expr: f > EV.dodge + 20 ? "relief" : "nervous", facing: 1 });
      zodiac(cam, out, "rat", 1, SQ[0] + 0.45 + 1.4 * k, D0, 19.5, t, { mode: moving ? "stroll" : "stand", phase: phs, expr: f > EV.dodge + 20 ? "relief" : "nervous", facing: -1 });
    } else if (f < 1116) {
      teller(cam, out, t, { expr: "stern", wave: 0.6 });
    } else if (f < EV.goatRat) {
      zodiac(cam, out, "horse", 6, SQ[0] - 1.0, D0, 20.0, t, { mode: "stand", expr: "stern", facing: -1 }, pop(f, EV.horseOx - 4, 8));
      zodiac(cam, out, "ox", 1, SQ[0] + 1.0, D0, 20.0, t, { mode: "stand", expr: "stern", facing: 1 }, pop(f, EV.horseOx, 8));
      for (const [k, s] of [[0, -1], [1, 1]] as const) {
        const u = (((f - EV.horseOx) / 16 + k * 0.5) % 1 + 1) % 1;
        if (f > EV.horseOx + 4) out.fx.push({ key: `snort${q(u, 20)}`, cw: 300, ch: 200, draw: (p) => fxSnort(p, q(u, 20)), x: SQ[0] + s * 0.55, y: D0 + 1.72, z: 19.9, w: 0.5, h: 0.33, rot: s > 0 ? Math.PI : 0, soft: true });
      }
      const bt = q(clamp01((f - EV.horseOx - 6) / 8), 20);
      if (bt > 0) span(out, cam, `bolt${bt}`, 1000, 200, (p) => fxBolt(p, bt, "#ffd84a", 3), [SQ[0] - 0.5, D0 + 1.45, 20], [SQ[0] + 0.5, D0 + 1.45, 20], 0.2);
    } else {
      const k = smooth((f - EV.goatRat - 8) / 24), phs = q((((f - EV.goatRat) / FPS) * 1.6) % 1, 60), moving = f > EV.goatRat + 8 && f < EV.goatRat + 32;
      const away = f >= EV.goatRat + 4;
      zodiac(cam, out, "goat", 7, SQ[0] - 0.8 - 1.2 * k, D0, 20.5, t, { mode: moving ? "stroll" : "stand", phase: phs, expr: away ? "stern" : "smile", facing: away ? 1 : -1 }, pop(f, EV.goatRat - 8, 8));
      zodiac(cam, out, "rat", 0, SQ[0] + 0.8 + 1.2 * k, D0, 20.5, t, { mode: moving ? "stroll" : "stand", phase: phs, expr: away ? "stern" : "smile", facing: away ? -1 : 1 }, pop(f, EV.goatRat - 6, 8));
    }
  }
};
/** threads (六合), clash bolts (冲 yellow, 害 violet) and the storm (刑) over the zodiac ring */
const sceneRing = (cam: CamInfo, f: number, t: number, out: Stage) => {
  const hit = f >= EV.chongs, harm = f >= EV.hais, xing = f >= EV.xing;
  ZODIAC.forEach((k, i) => {
    const [x, y, z] = ringPos(i);
    const expr: Expr = xing ? (i % 2 ? "dazed" : "pained") : harm ? (i % 3 ? "nervous" : "shock") : hit ? "shock" : f >= EV.liuhe ? (i % 2 ? "grin" : "smile_closed") : "smile";
    zodiac(cam, out, k, i, x, y, z, t, { mode: "stand", expr, look: hit && !xing ? (i % 2 ? 1 : -1) : 0 });
  });
  const waist = (i: number): V3 => { const [x, y, z] = ringPos(i); return [x, y + 0.55, z]; };
  if (f >= EV.liuhe && f < EV.bad) LIUHE.forEach(([a, b], n) => {
    const u = q(clamp01((f - EV.liuhe - n * 3) / 12), 20);
    if (u > 0) span(out, cam, `thread${u}`, 1000, 200, (p) => { const pts: [number, number][] = []; for (let i = 0; i <= 20 * u; i++) { const s = i / 20; pts.push([20 + 960 * s, 70 + 70 * Math.sin(Math.PI * s)]); } if (pts.length > 1) p.line(pts, "#e2353c", 8); }, waist(a), waist(b), 0.12);
    const hp = pop(f, EV.hearts + n * 2, 8);
    if (hp > 0.01) { const A = waist(a), B = waist(b); out.fx.push({ key: "heart", cw: 300, ch: 300, draw: (p) => fxHeart(p), x: (A[0] + B[0]) / 2, y: (A[1] + B[1]) / 2 + 0.9, z: (A[2] + B[2]) / 2, w: 0.85 * hp, h: 0.85 * hp }); }
  });
  if (hit) CHONG.forEach(([a, b], n) => {
    const u = q(clamp01((f - EV.chongs - n) / 6), 20);
    span(out, cam, `boltY${u}${n}`, 1000, 200, (p) => fxBolt(p, u, "#ffd84a", n, 8), waist(a), waist(b), 0.1);
  });
  if (harm) HAI.forEach(([a, b], n) => {
    const u = q(clamp01((f - EV.hais - n) / 6), 20);
    span(out, cam, `boltV${u}${n}`, 1000, 200, (p) => fxBolt(p, u, "#b48cff", n + 7, 8), waist(a), waist(b), 0.1);
  });
  if (xing) {
    const k = pop(f, EV.xing - 6, 10), fl = (f - EV.xing) % 14 < 3 ? 1 : 0;
    out.fx.push({ key: `storm${fl}`, cw: 600, ch: 400, draw: (p) => fxStorm(p, fl), x: SQ[0], y: D0 + 5.0, z: SQ[2] + 0.5, w: 4.6 * k, h: 3.05 * k });
  }
};
const sceneGears = (cam: CamInfo, f: number, out: Stage) => {
  const mesh: V3 = [SQ[0], D0 + 3.05, SQ[2] - 0.3];
  burst(out, f, EV.he, 10, mesh[0], mesh[1], mesh[2] - 0.3, 1.6, "#ffe9a0");
  dust(out, f, EV.jam + 6, 16, mesh[0] - 0.4, mesh[1], mesh[2] - 0.4, 2.4);
  burst(out, f, EV.jam + 6, 8, mesh[0], mesh[1], mesh[2] - 0.4, 2.0, "#ffffff");
  dust(out, f, EV.ka1, 14, mesh[0] + 0.3, mesh[1] + 0.2, mesh[2] - 0.4, 1.8);
  dust(out, f, EV.ka2, 14, mesh[0] - 0.2, mesh[1] - 0.1, mesh[2] - 0.4, 1.8);
  burst(out, f, EV.ka1, 6, mesh[0], mesh[1], mesh[2] - 0.4, 1.2);
  burst(out, f, EV.ka2, 6, mesh[0], mesh[1], mesh[2] - 0.4, 1.2);
};
const sceneProcession = (cam: CamInfo, f: number, t: number, out: Stage) => {
  DYNASTY.forEach((o, i) => {
    const z = -4.5 + (1.4 * (f - 1700)) / FPS - 1.9 * i;
    if (Math.abs(z) > 11.5) return;
    const x = i % 2 ? -0.45 : 0.45, y = deckY(z), view = viewOf(cam, x, z, 0, 1);
    const ph = q((((f - EV.march) / FPS) * 1.4 + i * 0.37) % 1, 60);
    const fo: FrontOpts = { mode: "stroll", phase: ph, expr: "smile", prop: "slip", blink: lidAt(t, 60 + i), seed: 20 + i };
    const so: SideOpts = { mode: "march", phase: ph, expr: "smile", stomp: 0.5, stride: 0.6 * view.fs, blink: lidAt(t, 60 + i), seed: 20 + i };
    out.places.push(person(cam, W(60 + i, o, "dyn" + i), x, y, z, view, fo, so));
    blob(out, x, y, z);
  });
};

/** everything with a face (and the 2D effects) in shot `id` at frame f */
export const stage = (id: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], t = f / FPS;
  LNAME = s.light;
  findSun(cam, SUN);
  if (id === 1) sceneHook(cam, f, t, out);
  if (id === 2) sceneMatchmaker(cam, f, t, out);
  if (id === 4 || id === 11) sceneHall(id, cam, f, t, out);
  if (id >= 5 && id <= 7) sceneStall(id, cam, f, t, out);
  if (id === 8) sceneRing(cam, f, t, out);
  if (id === 9) sceneGears(cam, f, out);
  if (id === 10) sceneProcession(cam, f, t, out);
  return out;
};
export { FPS, PILLAR_X, INK };
