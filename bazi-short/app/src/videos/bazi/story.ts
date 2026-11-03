// "八个字的婚事" (The Marriage Decided by Eight Characters): our original ~70 s short in the flat-characters-in-a-3D-toon
// world style. Timeline timed to the narration (timing.ts, generated from voice/words.json), story state per shot, the
// camera grammar of the bridge template (cuts on big jumps, smootherstep glides 18-40 f, every hold creeps, 7-frame
// flip kicks on impacts), lens blur per beat and foreground framing.
import { at, CL } from "./timing";

export const FPS = 30;
export const TOTAL = 2110;
export const D0 = 1.5; // canal bank top (m); water at y = 0
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
/** overshoot pop 0 -> 1 (back-out) over n frames from f0 */
export const pop = (f: number, f0: number, n = 8) => { const u = clamp01((f - f0) / n); if (u <= 0) return 0; const s = 1.9; return 1 + (s + 1) * (u - 1) ** 3 + s * (u - 1) ** 2; };

// ---------------- places ----------------
/** stone arch bridge at x = 0 across the canal (z -10..10): deck height along z */
export const BRIDGE_HALF = 10;
export const deckY = (z: number) => (Math.abs(z) < BRIDGE_HALF ? D0 + (4.0 - D0) * Math.cos((Math.PI * z) / (2 * BRIDGE_HALF)) ** 2 : D0);
/** town square (north bank, behind the riverfront row) */
export const SQ: V3 = [24, D0, 21];
export const PILLAR_X = [-2.4, -0.8, 0.8, 2.4].map((d) => SQ[0] + d);
export const PILLAR_H = 3.6;
export const STALL: V3 = [24, D0, 15.4]; // table centre; the teller stands 0.6 m behind it
export const ABACUS: V3 = [24.62, D0 + 0.86, 15.3];
export const SLIPS: [V3, V3] = [[23.72, D0 + 0.865, 15.25], [24.12, D0 + 0.865, 15.25]];
/** the ancestral hall (a separate set): floor y = 0, back wall at z = 3, the lens looks +z (screen right = -x) */
export const RM: V3 = [200, 0, 0];
export const ALTAR: V3 = [200, 0, 2.62];
export const CUP = { x0: 196.4, x1: 198.0, top: 1.9, z: 2.48 };
export const CAT_AT: V3 = [197.15, CUP.top, 2.5];
export const BOWL0: V3 = [197.72, CUP.top, 2.45];
/** zodiac ring around the square centre (子 at the far side, clockwise seen from above) */
export const RING_R = 5.0;
export const ringPos = (i: number): V3 => { const a = Math.PI / 2 - (i * Math.PI) / 6 + Math.PI / 12; return [SQ[0] + RING_R * Math.cos(a), D0, SQ[2] + RING_R * Math.sin(a) * 0.85]; };
export const LIUHE: [number, number][] = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
export const CHONG: [number, number][] = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
export const HAI: [number, number][] = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
/** the girl's chart on the slip and pillars: 甲子 丙寅 辛卯 庚寅; the young man's: 戊午 乙卯 丙子 甲午 */
export const HER = ["甲子", "丙寅", "辛卯", "庚寅"];
export const HIS = ["戊午", "乙卯", "丙子", "甲午"];

// ---------------- story beats (frames) ----------------
const L = 2; // reactions land 0-3 f before their word
export const EV = {
  slipFall: at(1, 0) + 2, slipLand: at(1, 8) - L,                          // hook: the red slip drops onto the bridge on "否"
  slipOpen: at(6, 0) - L,                                                   // "上面写着..." the slip opens
  rise: [0, 1, 2, 3].map((k) => at(7, k) - L),                              // 年 月 日 时: one pillar per word
  stems: at(8, 4) - L, branches: at(8, 8) - L, eight: at(10, 2) - L,        // 天干 / 地支 / 八个字
  place: at(11, 4) - L, bow: at(11, 9),                                     // 供在 ... 牌位前
  dayBranch: at(15, 8) - L,                                                 // 日柱地支
  figs: at(16, 5) - L,                                                      // 两人的属相: horse + rat figurines pop
  bead1: at(17, 2) - L, bead2: at(17, 4) - L,                               // 拨了拨
  horse: at(18, 2) - L, rat: at(19, 2) - L, chong: at(20, 3) - L,           // 马 / 鼠 / 冲
  dodge: at(21, 0), rhyme: at(22, 4) - L, horseOx: at(23, 0) - L, goatRat: at(24, 0) - L,
  liuhe: at(26, 8) - L, hearts: at(26, 13) - L,                             // 六合 ... 搭档
  bad: at(27, 0) - L, chongs: at(28, 8) - L, hais: at(28, 11) - L, xing: at(29, 6) - L,
  gearsUp: at(30, 0) - L, mesh: at(31, 0) - L, he: at(31, 5) - L, jam: at(33, 1) - L, ka1: at(34, 0) - L, ka2: at(34, 1) - L,
  march: at(35, 0) - 20,
  catLook: at(41, 0) - L, catPaw: at(42, 2) - L, push: at(43, 1) - L,
};
export const BOWL_TIP = EV.push + 16, BOWL_HIT = BOWL_TIP + 19;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type SetName = "town" | "hall";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 120, light: "day", set: "town", sunAz: 110, sunEl: 50 },     // hook: the slip falls between the pair
  { id: 2, a: 120, b: 332, light: "day", set: "town", sunAz: 140, sunEl: 45 },                          // Qing water town, the matchmaker, the slip
  { id: 3, a: 332, b: 515, light: "day", set: "town", sunAz: 60 },               // four pillars, eight characters
  { id: 4, a: 515, b: 700, light: "day", set: "hall", sunAz: 55, sunEl: 55 },    // ancestral altar, three to five days
  { id: 5, a: 700, b: 885, light: "day", set: "town", sunAz: 70 },               // the fortune teller
  { id: 6, a: 885, b: 1022, light: "day", set: "town", sunAz: 70 },              // abacus, horse vs rat, the clash
  { id: 7, a: 1022, b: 1200, light: "golden", set: "town" },                     // the rhyme
  { id: 8, a: 1200, b: 1495, light: "golden", set: "town", sunAz: 20, sunEl: 12 }, // zodiac ring
  { id: 9, a: 1495, b: 1700, light: "golden", set: "town", sunAz: 25, sunEl: 10 }, // gears
  { id: 10, a: 1700, b: 1850, light: "golden", set: "town" },                    // a thousand years of matchmakers
  { id: 11, a: 1850, b: TOTAL, light: "day", set: "hall", sunAz: 55, sunEl: 55 }, // the cat and the bowl
];
export const XFADE: Record<number, number> = { 4: 8, 7: 10, 10: 8, 11: 10 };
export const FLASH_AT = 120;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixC = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixC(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
/** push-in factor since f0 (0.15-0.35 %/f creep; `punch` for the first n frames) */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
const D = D0;
const [SX, , SZ] = SQ;

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: (f) => dolly([6.5, 10.5, -22], [0, 2.8, 1.5], pushK(f, 0, 0.0025), { fov: 46 }) },
    { f: 52, dur: 30, s: (f) => dolly([4.2, 8.2, -15.5], [0, 3.6, 0], pushK(f, 52, 0.003), { fov: 44, roll: -0.04 }) }, // centred on "婚事"
    { f: EV.slipLand - 1, dur: 18, s: (f) => dolly([3.6, 7.6, -13.5], [0, 3.8, 0], pushK(f, EV.slipLand, 0.0035), { fov: 42, roll: 0.035 }) },
  ],
  2: [
    { f: 120, s: (f) => zoom([-26, 3.6, -1.2], [4, 2.6, 1.0], 46, pushK(f, 120, 0.0016)) },                                     // 清朝，江南小镇
    { f: 186, cut: true, s: (f) => dolly([1.6, 5.9, 10.5], [0, 5.3, 1.0], pushK(f, 186, 0.0022), { fov: 40 }) },                  // the matchmaker on the bridge
    { f: 237, cut: true, s: (f) => dolly([0.9, 5.25, 6.6], [0.15, 5.2, 2.2], pushK(f, 237, 0.0025, 0.006, 22), { fov: 36, roll: 0.035 }) }, // 庚帖
    { f: EV.slipOpen, cut: true, s: (f) => dolly([0.35, 5.35, -1.9], [0, 5.3, 2.0], pushK(f, EV.slipOpen, 0.0022), { fov: 34 }) },  // the open slip
  ],
  3: [
    { f: 332, s: (f) => dolly([SX + 1.2, D + 2.1, 8.5], [SX, D + 2.0, SZ], pushK(f, 332, 0.0018), { fov: 50 }) },
    { f: EV.stems - 12, dur: 28, s: (f) => dolly([SX - 2.4, D + 2.6, 12.6], [SX - 0.8, D + 2.75, SZ], pushK(f, EV.stems, 0.0022), { fov: 38, roll: 0.035 }) },
    { f: EV.branches - 10, dur: 24, s: (f) => dolly([SX + 2.6, D + 1.1, 12.8], [SX + 0.8, D + 1.05, SZ], pushK(f, EV.branches, 0.0022), { fov: 38, roll: -0.035 }) },
    { f: 440, cut: true, s: (f) => dolly([SX, D + 2.4, 9.8], [SX, D + 2.0, SZ], pushK(f, 440, 0.002, 0.006, 30), { fov: 46 }) },  // 四根柱子 / 八个字
  ],
  4: [
    { f: 511, s: (f) => dolly([200.9, 1.55, -1.6], [200.15, 1.3, 2.5], pushK(f, 511, 0.0022), { fov: 40 }) },                   // altar + father
    { f: 590, cut: true, s: (f) => dolly([199.3, 1.75, -4.2], [198.9, 1.15, 2.2], pushK(f, 590, 0.0018), { fov: 48 }) },          // the household tiptoes
    { f: 642, cut: true, s: (f) => dolly([198.6, 1.95, -0.9], [197.75, 1.95, 2.45], pushK(f, 642, 0.0025, 0.006, 30), { fov: 40, roll: 0.03 }) }, // father vs cat
  ],
  5: [
    { f: 696, s: (f) => dolly([25.1, D + 1.9, 11.4], [24.05, D + 1.5, 16], pushK(f, 696, 0.0022), { fov: 40 }) },                // the teller
    { f: 757, cut: true, s: (f) => zoom([27.2, D + 1.25, 16.6], [PILLAR_X[2], D + 1.1, SZ], 30, pushK(f, 757, 0.0022, 0.006, 30)) }, // 日柱地支
    { f: 826, cut: true, s: (f) => dolly([24.05, D + 1.55, 13.9], [23.95, D + 0.98, 15.3], pushK(f, 826, 0.0025), { fov: 34 }) },   // the slips, the signs
  ],
  6: [
    { f: 885, s: (f) => dolly([24.78, D + 1.22, 14.62], [ABACUS[0], ABACUS[1] + 0.02, ABACUS[2]], pushK(f, 885, 0.0025), { fov: 34, roll: -0.03 }) },
    { f: 935, cut: true, s: (f) => dolly([23.92, D + 1.2, 14.35], [23.92, D + 1.03, 15.25], pushK(f, 935, 0.003), { fov: 32 }) },  // 男属马 女属鼠
    { f: 984, cut: true, s: (f) => dolly([SX, D + 2.6, 9.4], [SX, D + 2.1, SZ], pushK(f, 984, 0.002, 0.007, 24), { fov: 48 }) },   // 子午相冲
  ],
  7: [
    { f: 1017, s: (f) => dolly([SX + 0.4, D + 1.75, 12.6], [SX, D + 1.25, 19], pushK(f, 1017, 0.002), { fov: 44 }) },             // 躲过相冲
    { f: 1073, cut: true, s: (f) => dolly([24.95, D + 1.85, 12.9], [24.05, D + 1.65, 16], pushK(f, 1073, 0.0025), { fov: 38, roll: 0.035 }) }, // 口诀
    { f: 1116, cut: true, s: (f) => dolly([SX, D + 1.7, 14.2], [SX, D + 1.3, 20], pushK(f, 1116, 0.002), { fov: 42 }) },          // 白马怕青牛
    { f: EV.goatRat - 6, dur: 22, s: (f) => dolly([SX - 0.6, D + 1.6, 14.6], [SX, D + 1.25, 20.5], pushK(f, EV.goatRat, 0.002), { fov: 44, roll: -0.035 }) },
  ],
  8: [
    { f: 1195, s: (f) => dolly([SX, D + 10.5, 9.5], [SX, D + 0.6, SZ + 0.6], pushK(f, 1195, 0.0016), { fov: 46 }) },
    { f: 1325, cut: true, s: (f) => dolly([SX + 1.2, D + 6.2, 12.0], [SX, D + 0.9, SZ], pushK(f, 1325, 0.0022), { fov: 46 }) },
    { f: EV.chongs - 6, dur: 18, s: rolled((f) => dolly([SX + 1.2, D + 6.2, 12.0], [SX, D + 0.9, SZ], pushK(f, 1325, 0.0022), { fov: 46 }), 0.04) },
    { f: 1436, cut: true, s: (f) => dolly([SX, D + 4.4, 11.0], [SX, D + 1.6, SZ], pushK(f, 1436, 0.0025), { fov: 50 }) },          // 刑: storm overhead
  ],
  9: [
    { f: 1490, s: (f) => dolly([SX, D + 3.0, 11.0], [SX, D + 3.0, SZ], pushK(f, 1490, 0.0016), { fov: 48 }) },
    { f: 1548, dur: 30, s: (f) => dolly([SX + 1.4, D + 3.1, 13.4], [SX, D + 3.0, SZ], pushK(f, 1563, 0.002), { fov: 44, roll: 0.035 }) },
    { f: EV.jam - 4, cut: true, s: (f) => dolly([SX + 0.6, D + 3.0, 16.4], [SX, D + 3.0, SZ], pushK(f, EV.jam, 0.0025, 0.006, 30), { fov: 40, roll: -0.035 }) },
  ],
  10: [
    { f: 1695, s: (f) => dolly([13, 5.2, -1.5], [0, 4.1, 0.4], pushK(f, 1695, 0.0018), { fov: 44 }) },
    { f: 1770, dur: 40, s: (f) => dolly([26, 10.5, -7], [0, 3.8, 2], pushK(f, 1790, 0.0012), { fov: 46 }) },                         // crane out: a thousand years
  ],
  11: [
    { f: 1845, s: (f) => dolly([199.0, 1.8, -3.0], [198.4, 1.35, 2.4], pushK(f, 1845, 0.0018), { fov: 46 }) },
    { f: 1882, cut: true, s: (f) => dolly([197.95, 2.25, 0.75], [197.45, 2.08, 2.45], pushK(f, 1882, 0.0022), { fov: 38 }) },   // cat + bowl
    { f: 1960, dur: 24, s: (f) => dolly([197.6, 2.2, 1.0], [197.2, 2.15, 2.45], pushK(f, 1972, 0.0025, 0.006, 26), { fov: 36, roll: 0.035 }) }, // 八字不合: the cat looks at us
    { f: EV.push - 4, cut: true, s: (f) => dolly([198.55, 1.35, -1.05], [197.75, 1.1, 2.45], pushK(f, EV.push, 0.0018), { fov: 48 }) }, // the push, the drop
  ],
};

// impact kicks: image offset flips sign every frame, decays in 7 f
const KICKS: [number, number][] = [
  [EV.slipLand, 1.3], ...EV.rise.map((f) => [f + 7, 0.35] as [number, number]), [EV.bead1, 0.3], [EV.bead2, 0.3], [EV.chong, 1.4],
  [EV.chongs, 0.8], [EV.hais, 0.5], [EV.xing, 0.9], [EV.jam + 8, 0.9], [EV.ka1, 0.8], [EV.ka2, 0.8], [BOWL_HIT, 1.2],
].map(([f, g]) => [f / FPS, g]);
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const Ld = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * Ld * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, { f: 186, cInf: 10 }, { f: 237, cInf: 13 }, { f: EV.slipOpen, cInf: 14 },
  { f: 332, cInf: 0 }, { f: EV.stems - 12, dur: 28, cInf: 8 }, { f: 440, cInf: 0 },
  { f: 511, cInf: 10 }, { f: 590, cInf: 5 }, { f: 642, cInf: 12, focus: () => [CAT_AT[0], CAT_AT[1] + 0.3, CAT_AT[2]] },
  { f: 696, cInf: 10, focus: () => [24.05, D0 + 1.75, 16.0] }, { f: 757, cInf: 12 }, { f: 826, cInf: 14 },
  { f: 885, cInf: 15 }, { f: 935, cInf: 14 }, { f: 984, cInf: 0 },
  { f: 1017, cInf: 8 }, { f: 1073, cInf: 11, focus: () => [24.05, D0 + 1.75, 16.0] }, { f: 1116, cInf: 7 },
  { f: 1195, cInf: 0 }, { f: 1490, cInf: 4 }, { f: 1695, cInf: 0 },
  { f: 1845, cInf: 6 }, { f: 1882, cInf: 13 }, { f: EV.push - 4, cInf: 8 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const sceneT = (f: number) => T(f);
export { CL };
