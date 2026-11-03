// Jiangnan water-town set: painted textures (white plaster facades, dark tile roofs, stone slabs, red lacquer, wood,
// red paper slips with the eight characters) and static builders (houses with stepped "horse-head" gable walls, the
// stone arch bridge, canal walls, quays, lanterns, boats, the square, the ancestral hall). Dynamic props live in
// world.ts. All materials go through lam() (two-tone shading, shade.ts) so they match the template look.
import * as THREE from "three";
import { Batch, V, lam, quad, tri, boxGeo, inTheWay, prop, Kit } from "./build";
import { ctex, rng, rep, stoneHD } from "./paint";
import { D0, deckY, BRIDGE_HALF } from "./story";

export const FONT = `"AR PL UKai CN", "AR PL UKai TW", "Noto Serif CJK SC", "Noto Sans CJK SC", serif`;
const U = (r: () => number, a: number, b: number) => a + (b - a) * r();

// ---------------- textures ----------------
/** white plaster facade (64 px/m): grime at the foot, rain streaks, dark lattice windows, a wooden door with red couplets */
export const plasterTex = (key: string, wm: number, hm: number, o: { door?: boolean; win?: number; upper?: boolean } = {}) =>
  ctex("plaster_" + key, Math.round(wm * 64), Math.round(hm * 64), (g, r) => {
    const W = Math.round(wm * 64), H = Math.round(hm * 64), px = 64;
    g.fillStyle = "#f3ead6"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { // soft weathering blotches
      const x = U(r, 0, W), y = U(r, 0, H), rad = U(r, 20, 70), gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(150,150,140,${U(r, 0.05, 0.12)})`); gr.addColorStop(1, "rgba(150,150,140,0)");
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
    }
    for (let i = 0; i < Math.round(wm * 1.5); i++) { // rain streaks under the eaves
      const x = U(r, 0, W), l = U(r, 0.6, 2.2) * px, gr = g.createLinearGradient(0, 0, 0, l);
      gr.addColorStop(0, "rgba(90,95,95,0.22)"); gr.addColorStop(1, "rgba(90,95,95,0)");
      g.fillStyle = gr; g.fillRect(x, 0, U(r, 3, 9), l);
    }
    const foot = g.createLinearGradient(0, H - 0.9 * px, 0, H); // damp grime at the foot
    foot.addColorStop(0, "rgba(110,120,105,0)"); foot.addColorStop(1, "rgba(95,105,90,0.45)");
    g.fillStyle = foot; g.fillRect(0, H - 0.9 * px, W, 0.9 * px);
    const win = (cx: number, top: number, w: number, h: number) => {
      g.fillStyle = "#3a2a24"; g.fillRect(cx - w / 2 - 6, top - 6, w + 12, h + 12);
      g.fillStyle = "#e9dcc0"; g.fillRect(cx - w / 2, top, w, h);
      g.strokeStyle = "#4a3329"; g.lineWidth = 4;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(cx - w / 2 + (w * k) / 4, top); g.lineTo(cx - w / 2 + (w * k) / 4, top + h); g.stroke(); }
      for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(cx - w / 2, top + (h * k) / 5); g.lineTo(cx + w / 2, top + (h * k) / 5); g.stroke(); }
      g.fillStyle = "rgba(60,40,30,0.25)"; g.fillRect(cx - w / 2, top, w, 8);
    };
    const n = o.win ?? Math.max(1, Math.floor(wm / 2.6));
    const floors = hm > 4.6 ? 2 : 1;
    for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) {
      const cx = ((i + 0.5) / n) * W, y0 = H - (fl * 2.9 + 1.0 + 1.3) * px;
      if (o.door && fl === 0 && i === Math.floor(n / 2)) continue;
      if (fl === 0 && !o.upper && r() < 0.3) continue;
      win(cx, y0, 0.95 * px, 1.15 * px);
    }
    if (o.door) {
      const cx = (Math.floor(n / 2) + 0.5) / n * W, w = 1.25 * px, h = 2.15 * px, y0 = H - h - 0.12 * px;
      g.fillStyle = "#2f241f"; g.fillRect(cx - w / 2 - 10, y0 - 10, w + 20, h + 10);
      g.fillStyle = "#6b3f2a"; g.fillRect(cx - w / 2, y0, w, h);
      g.strokeStyle = "#3a2a24"; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, y0); g.lineTo(cx, y0 + h); g.stroke();
      for (const s of [-1, 1]) { g.fillStyle = "#c8323a"; g.fillRect(cx + s * (w / 2 + 16) - (s < 0 ? 22 : 0), y0 + 8, 22, h * 0.8); } // plain red couplets
      g.fillStyle = "#c8323a"; g.fillRect(cx - w / 2, y0 - 34, w, 20);
    }
  });
/** dark tile roof, 512 px = 4 m: tile channels run down the slope (v), eave tile ends at v = 1 */
export const tileTex = () => ctex("jnTiles", 512, 512, (g, r) => {
  g.fillStyle = "#4c515b"; g.fillRect(0, 0, 512, 512);
  const cw = 512 / 18;
  for (let i = 0; i < 18; i++) {
    const x = i * cw, gr = g.createLinearGradient(x, 0, x + cw, 0);
    const k = U(r, -0.04, 0.04);
    gr.addColorStop(0, `rgba(30,32,40,${0.35 + k})`); gr.addColorStop(0.35, `rgba(150,155,170,${0.18 + k})`); gr.addColorStop(0.7, "rgba(90,95,105,0.05)"); gr.addColorStop(1, `rgba(25,27,35,${0.4 + k})`);
    g.fillStyle = gr; g.fillRect(x, 0, cw, 512);
    for (let y = 0; y < 512; y += 32) { g.fillStyle = "rgba(20,22,28,0.25)"; g.fillRect(x, y + U(r, -2, 2), cw, 3); }
  }
  for (let i = 0; i < 10; i++) { const x = U(r, 0, 512), y = U(r, 0, 512), rad = U(r, 30, 80), gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, "rgba(90,110,80,0.15)"); gr.addColorStop(1, "rgba(90,110,80,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); }
});
/** grey stone slab paving, 1024 px = 4 m */
export const slabTex = () => ctex("jnSlabs", 1024, 1024, (g, r) => {
  g.fillStyle = "#a9a59c"; g.fillRect(0, 0, 1024, 1024);
  const rowH = 128;
  for (let y = 0; y < 1024; y += rowH) {
    let x = -U(r, 0, 200);
    while (x < 1024) {
      const w = U(r, 180, 320), v = U(r, -14, 14);
      g.fillStyle = `rgb(${186 + v},${170 + v},${146 + v})`; g.fillRect(x + 3, y + 3, w - 6, rowH - 6);
      g.fillStyle = "rgba(255,255,250,0.10)"; g.fillRect(x + 3, y + 3, w - 6, 6);
      for (let k = 0; k < 3; k++) { const cx = x + U(r, 0, w), cy = y + U(r, 0, rowH), rad = U(r, 10, 40), gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad); gr.addColorStop(0, "rgba(90,95,85,0.12)"); gr.addColorStop(1, "rgba(90,95,85,0)"); g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, 2 * rad, 2 * rad); }
      x += w;
    }
    g.fillStyle = "rgba(60,58,55,0.55)"; g.fillRect(0, y, 1024, 3);
  }
  for (let x = 0; x < 1024; x += 1) if (r() < 0.002) { g.fillStyle = "rgba(60,58,55,0.4)"; g.fillRect(x, 0, 3, 1024); }
});
/** dark wood with grain, 256 px = 1 m */
export const woodTex = (key: string, base: string) => ctex("jnWood" + key, 256, 256, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { const y = U(r, 0, 256); g.strokeStyle = `rgba(30,15,10,${U(r, 0.08, 0.2)})`; g.lineWidth = U(r, 1, 3); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + U(r, -6, 6), 170, y + U(r, -6, 6), 256, y); g.stroke(); }
  g.fillStyle = "rgba(255,230,200,0.06)"; g.fillRect(0, 0, 256, 40);
});
const gold = "#f3cc5a";
const charsOn = (g: CanvasRenderingContext2D, txt: string, x: number, y: number, size: number, col = gold, stroke = "#5a1414") => {
  g.font = `${size}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineJoin = "round"; g.lineWidth = size * 0.08; g.strokeStyle = stroke; g.strokeText(txt, x, y);
  g.fillStyle = col; g.fillText(txt, x, y);
};
/** red paper slip (庚帖): gold border, the eight characters in four columns read right to left (year .. hour) */
export const slipTex = (key: string, pillars: string[]) => ctex("slip_" + key, 512, 768, (g, r) => {
  g.fillStyle = "#cf4a2e"; g.fillRect(0, 0, 512, 768);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,200,180" : "90,10,10"},0.06)`; g.fillRect(U(r, 0, 512), U(r, 0, 768), U(r, 2, 14), U(r, 2, 14)); }
  g.strokeStyle = gold; g.lineWidth = 12; g.strokeRect(26, 26, 460, 716);
  g.lineWidth = 3; g.strokeRect(44, 44, 424, 680);
  pillars.forEach((p, i) => { const x = 512 - 44 - (424 / 4) * (i + 0.5); charsOn(g, p[0], x, 250, 96); charsOn(g, p[1], x, 520, 96); });
});
/** single gold character on red lacquer for the pillar plaques (glow uses the same map as emissive) */
export const plaqueTex = (ch: string) => ctex("plaque_" + ch, 256, 344, (g) => {
  g.fillStyle = "#a8462e"; g.fillRect(0, 0, 256, 344);
  g.strokeStyle = gold; g.lineWidth = 8; g.strokeRect(14, 14, 228, 316);
  charsOn(g, ch, 128, 180, 200);
});
export const plaqueGlow = (ch: string) => ctex("plaqueGlow_" + ch, 256, 344, (g) => {
  g.fillStyle = "#000000"; g.fillRect(0, 0, 256, 344);
  g.strokeStyle = "#ffffff"; g.lineWidth = 8; g.strokeRect(14, 14, 228, 316);
  charsOn(g, ch, 128, 180, 200, "#ffffff", "#ffffff");
});
/** stall banner: white cloth, black ink "命理" */
const bannerTex = () => ctex("jnBanner", 256, 640, (g) => {
  g.fillStyle = "#f2efe6"; g.fillRect(0, 0, 256, 640);
  g.fillStyle = "#1e3a6e"; g.fillRect(0, 0, 256, 34); g.fillRect(0, 606, 256, 34);
  charsOn(g, "命", 128, 210, 190, "#1d1b22", "#1d1b22"); charsOn(g, "理", 128, 430, 190, "#1d1b22", "#1d1b22");
});
/** landscape scroll (no text): misty hills, a pine */
const scrollTex = () => ctex("jnScroll", 256, 640, (g) => {
  g.fillStyle = "#e8dfc8"; g.fillRect(0, 0, 256, 640);
  g.fillStyle = "#7a5a3a"; g.fillRect(0, 0, 256, 26); g.fillRect(0, 614, 256, 26);
  for (const [y, c] of [[360, "rgba(60,70,80,0.35)"], [430, "rgba(60,70,80,0.55)"], [500, "rgba(40,50,60,0.75)"]] as const) {
    g.fillStyle = c; g.beginPath(); g.moveTo(20, y + 60); g.quadraticCurveTo(80, y - 90, 140, y + 10); g.quadraticCurveTo(190, y - 60, 236, y + 60); g.closePath(); g.fill();
  }
  g.strokeStyle = "#3a3a3a"; g.lineWidth = 6; g.beginPath(); g.moveTo(70, 590); g.lineTo(90, 420); g.stroke();
  g.fillStyle = "rgba(40,70,50,0.7)"; for (const y of [430, 470, 510]) { g.beginPath(); g.ellipse(95, y, 46, 12, -0.2, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#c8323a"; g.fillRect(200, 560, 18, 18); // a seal
});
const latticeTex = () => ctex("jnLattice", 256, 256, (g) => {
  g.fillStyle = "#f4e6c4"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#4a3329"; g.lineWidth = 7;
  for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32, 256); g.stroke(); g.beginPath(); g.moveTo(0, k * 32); g.lineTo(256, k * 32); g.stroke(); }
  g.lineWidth = 14; g.strokeRect(0, 0, 256, 256);
});
const porcelainTex = () => ctex("jnPorcelain", 256, 128, (g) => {
  g.fillStyle = "#f6f7fb"; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#3f5fb5"; g.fillRect(0, 26, 256, 9); g.fillRect(0, 96, 256, 5);
  g.strokeStyle = "#4f6fc5"; g.lineWidth = 4;
  for (let x = 8; x < 256; x += 32) { g.beginPath(); g.arc(x + 8, 62, 10, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(x - 6, 78); g.quadraticCurveTo(x + 8, 70, x + 22, 80); g.stroke(); }
});

// ---------------- materials ----------------
export const M = {
  tiles: () => lam("jnTiles", () => ({ map: tileTex(), side: THREE.DoubleSide })),
  ridge: () => lam("jnRidge", () => ({ color: "#3a3e47" })),
  cap: () => lam("jnCap", () => ({ color: "#42464f" })),
  white: () => lam("jnWhite", () => ({ map: rep(plasterTex("plain", 4, 4, { win: 0 }), 1, 1) })),
  slab: () => lam("jnSlab", () => ({ map: slabTex() })),
  stone: () => lam("jnStone", () => ({ map: stoneHD("jnStoneHD", ["#c4b49a", "#b8a88e", "#cdbfa5", "#b0a088"], "#8c7e68") })),
  cope: () => lam("jnCope", () => ({ color: "#bdb9b0" })),
  wood: () => lam("jnWoodDk", () => ({ map: woodTex("dk", "#5b3524") })),
  woodRed: () => lam("jnWoodRed", () => ({ map: woodTex("red", "#6c3a2e") })),
  woodLt: () => lam("jnWoodLt", () => ({ map: woodTex("lt", "#b98552") })),
  lacquer: () => lam("jnLacquer", () => ({ color: "#a5432c" })),
  gold: () => lam("jnGold", () => ({ color: "#d9ad48" })),
  bronze: () => lam("jnBronze", () => ({ color: "#8a6a3a" })),
  black: () => lam("jnBlack", () => ({ color: "#2b2a30" })),
  lanternRed: () => lam("jnLantern", () => ({ color: "#d8342e", emissive: new THREE.Color("#ff3a22"), emissiveIntensity: 0.45 })),
  cloth: () => lam("jnCloth", () => ({ color: "#2f4f8a" })),
  banner: () => lam("jnBannerM", () => ({ map: bannerTex(), side: THREE.DoubleSide })),
  scroll: () => lam("jnScrollM", () => ({ map: scrollTex() })),
  lattice: () => lam("jnLatticeM", () => ({ map: latticeTex(), emissive: new THREE.Color("#ffe9b8"), emissiveIntensity: 0.25 })),
  porcelain: () => lam("jnPorcelainM", () => ({ map: porcelainTex() })),
  hill: (i: number) => lam("jnHill" + i, () => ({ color: ["#8fa69a", "#9fb3ab", "#7f988e"][i % 3] })),
  grass: () => lam("jnGrass", () => ({ color: "#7aa85a" })),
};

// ---------------- houses ----------------
/** Jiangnan house, front (local +z) on the line, ridge along local x; stepped gable walls stand above both ends */
export const jnHouse = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, seed: number, y = D0) => {
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 0.6, hz = (across ? w : d) / 2 + 0.6, rh = d * 0.36;
  if (inTheWay(x - hx, x + hx, y, y + h + rh + 1.2, z - hz, z + hz)) return;
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  const r = rng(seed + 3), door = r() < 0.75;
  const front = lam(`jnF${seed % 6}_${w}_${h}`, () => ({ map: plasterTex(`f${seed % 6}_${w}_${h}`, w, h, { door, upper: true }) }));
  const side = lam(`jnS_${d}_${h}`, () => ({ map: plasterTex(`s_${d}_${h}`, d, h + rh + 1.2, { win: 1 }) }));
  const hw = w / 2, hd = d / 2, o = 0.55;
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), front, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), front, m);
  // gable ends: wall up to the stepped top (uv in metres of the side texture)
  const steps = [[hd, hd * 0.62, h + 0.55], [hd * 0.62, hd * 0.26, h + rh * 0.62 + 0.45], [hd * 0.26, -hd * 0.26, h + rh + 0.5], [-hd * 0.26, -hd * 0.62, h + rh * 0.62 + 0.45], [-hd * 0.62, -hd, h + 0.55]];
  const TH = h + rh + 1.2;
  for (const s of [-1, 1]) {
    for (const [za, zb, top] of steps) {
      const z0 = Math.min(za, zb), z1 = Math.max(za, zb), xs = s * (hw + 0.02);
      const u0 = (z0 + hd) / d, u1 = (z1 + hd) / d;
      const g = s > 0 ? quad(V(xs, 0, z1), V(xs, 0, z0), V(xs, top, z0), V(xs, top, z1), 1 - u0, top / TH, 1 - u1, 0) : quad(V(xs, 0, z0), V(xs, 0, z1), V(xs, top, z1), V(xs, top, z0), u1, top / TH, u0, 0);
      b.add(g, side, m);
      b.add(boxGeo(V(s * hw - 0.2, top - 0.02, z0 - 0.04), V(s * hw + 0.2, top + 0.22, z1 + 0.04)), M.white(), m);                // wall thickness above the roof
      b.add(boxGeo(V(s * hw - 0.32, top + 0.22, z0 - 0.12), V(s * hw + 0.32, top + 0.36, z1 + 0.12)), M.cap(), m);              // tile cap
    }
    // the white wall's inner face above the roof (seen from the roof side)
  }
  // roof slopes with overhang over front and back (the gable walls cover the ends)
  const tm = M.tiles(), ru = w / 4, rv = Math.hypot(hd + o, rh) / 4;
  b.add(quad(V(-hw, h - 0.3, hd + o), V(hw, h - 0.3, hd + o), V(hw, h + rh, 0), V(-hw, h + rh, 0), ru, rv), tm, m);
  b.add(quad(V(hw, h - 0.3, -hd - o), V(-hw, h - 0.3, -hd - o), V(-hw, h + rh, 0), V(hw, h + rh, 0), ru, rv), tm, m);
  b.add(boxGeo(V(-hw, h + rh - 0.08, -0.16), V(hw, h + rh + 0.2, 0.16)), M.ridge(), m);                                       // ridge
  b.add(boxGeo(V(-hw, h - 0.42, hd + o - 0.12), V(hw, h - 0.26, hd + o + 0.04)), M.black(), m);                               // eave line
  b.add(boxGeo(V(-hw, h - 0.42, -hd - o - 0.04), V(hw, h - 0.26, -hd - o + 0.12)), M.black(), m);
  b.add(boxGeo(V(-hw - 0.03, -0.05, -hd - 0.03), V(hw + 0.03, 0.42, hd + 0.03)), M.stone(), m);                               // stone plinth
  // a small porch roof over the door
  if (door) b.add(quad(V(-1.1, 2.75, hd + 0.75), V(1.1, 2.75, hd + 0.75), V(1.1, 3.05, hd), V(-1.1, 3.05, hd), 0.6, 0.2), tm, m);
};

// ---------------- canal + bridge ----------------
/** arch profile in (z, y): deck on top, the semicircular opening over the water, footings on both banks */
const bridgeShape = () => {
  const s = new THREE.Shape(), R = 3.6, cy = -0.2;
  s.moveTo(-BRIDGE_HALF, D0 - 0.1); s.lineTo(-6, D0 - 0.1); s.lineTo(-6, -0.5); s.lineTo(-R, -0.5); s.lineTo(-R, cy);
  for (let i = 0; i <= 32; i++) { const a = Math.PI - (i / 32) * Math.PI; s.lineTo(R * Math.cos(a), cy + R * Math.sin(a)); }
  s.lineTo(R, -0.5); s.lineTo(6, -0.5); s.lineTo(6, D0 - 0.1); s.lineTo(BRIDGE_HALF, D0 - 0.1);
  for (let i = 0; i <= 40; i++) { const z = BRIDGE_HALF - (i / 40) * 2 * BRIDGE_HALF; s.lineTo(z, deckY(z)); }
  return s;
};
const along = (g: THREE.BufferGeometry, x: number) => { g.rotateY(Math.PI / 2); g.translate(x, 0, 0); return g; }; // shape z -> world z, extrude -> world x
export const buildBridge = (b: Batch) => {
  const W = 3.4;
  const body = new THREE.ExtrudeGeometry(bridgeShape(), { depth: W, bevelEnabled: false, curveSegments: 32 });
  // uv: ExtrudeGeometry uses shape coords on the caps; rescale to 2 m stone courses
  const uv = body.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
  b.add(along(body, -W / 2), M.stone());
  // parapets following the deck, with coping
  for (const s of [-1, 1]) {
    const ps = new THREE.Shape();
    const zs = Array.from({ length: 41 }, (_, i) => -BRIDGE_HALF + (i / 40) * 2 * BRIDGE_HALF);
    ps.moveTo(zs[0], deckY(zs[0]) - 0.05); zs.forEach((z) => ps.lineTo(z, deckY(z) + 0.62)); [...zs].reverse().forEach((z) => ps.lineTo(z, deckY(z) - 0.05));
    const pg = new THREE.ExtrudeGeometry(ps, { depth: 0.24, bevelEnabled: false });
    const puv = pg.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < puv.count; i++) puv.setXY(i, puv.getX(i) / 2, puv.getY(i) / 2);
    b.add(along(pg, s * (W / 2) - (s > 0 ? 0.24 : 0)), M.cope());
    for (const z of [-BRIDGE_HALF, BRIDGE_HALF]) b.add(boxGeo(V(s * W / 2 - 0.2, D0, z - 0.2), V(s * W / 2 + 0.2, D0 + 1.1, z + 0.2)), M.cope());
  }
  // step edges on the deck (thin dark strips every 0.45 m of rise)
  for (let z = -BRIDGE_HALF + 0.4; z < BRIDGE_HALF - 0.2; z += 0.5)
    b.add(boxGeo(V(-W / 2 + 0.25, deckY(z) - 0.02, z - 0.012), V(W / 2 - 0.25, deckY(z) + 0.008, z + 0.012)), lam("jnStep", () => ({ color: "#6a645c" })));
};
export const buildCanal = (b: Batch) => {
  const stone = M.stone();
  for (const s of [-1, 1]) {
    const z = s * 6;
    const g = s < 0 ? quad(V(-400, -0.6, z), V(400, -0.6, z), V(400, D0, z), V(-400, D0, z), 200, 1.05) : quad(V(400, -0.6, z), V(-400, -0.6, z), V(-400, D0, z), V(400, D0, z), 200, 1.05);
    b.add(g, stone);
    b.add(boxGeo(V(-400, D0 - 0.05, s < 0 ? -6.35 : 5.65), V(400, D0 + 0.06, s < 0 ? -5.65 : 6.35)), M.cope());
    // quay + streets: slab paving up to z +-300
    const z0 = s < 0 ? -300 : 6, z1 = s < 0 ? -6 : 300;
    const pg = new THREE.PlaneGeometry(800, 294, 1, 1); pg.rotateX(-Math.PI / 2); pg.translate(0, D0, (z0 + z1) / 2);
    const uv = pg.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 200, uv.getY(i) * 73.5);
    b.add(pg, M.slab());
  }
  const bed = new THREE.PlaneGeometry(800, 12); bed.rotateX(-Math.PI / 2); bed.translate(0, -0.6, 0);
  b.add(bed, lam("jnBed", () => ({ color: "#3f5a52" })));
};
/** wooden boat with a black arched awning (乌篷船), as its own group (base at the waterline, bow toward +x) */
export const boat = () => {
  const g = new THREE.Group(), bb = new Batch();
  const hull = new THREE.Shape(); hull.moveTo(-3.2, 0.1); hull.quadraticCurveTo(-2.6, -0.35, 0, -0.38); hull.quadraticCurveTo(2.6, -0.35, 3.3, 0.25); hull.lineTo(3.3, 0.38); hull.lineTo(-3.2, 0.38); hull.closePath();
  const hg = new THREE.ExtrudeGeometry(hull, { depth: 1.3, bevelEnabled: false }); hg.translate(0, 0, -0.65);
  bb.add(hg, M.wood());
  const aw = new THREE.CylinderGeometry(0.62, 0.62, 2.4, 14, 1, true, 0, Math.PI); aw.rotateZ(Math.PI / 2); aw.translate(-0.4, 0.38, 0);
  bb.add(aw, lam("jnAwning", () => ({ color: "#2e2c33", side: THREE.DoubleSide })));
  bb.add(boxGeo(V(-3.0, 0.38, -0.04), V(-2.0, 0.42, 0.04)), M.wood());
  bb.build(g);
  return g;
};
/** red silk lantern on a bracket, hanging at y (top) */
export const lantern = (b: Batch, x: number, y: number, z: number, out = 0.5, sgn = 1) => {
  b.add(boxGeo(V(x - 0.04, y + 0.25, z - (sgn < 0 ? out : 0)), V(x + 0.04, y + 0.31, z + (sgn > 0 ? out : 0))), M.wood());
  const zc = z + sgn * out;
  b.add(new THREE.SphereGeometry(0.3, 18, 12).scale(1, 1.15, 1), M.lanternRed(), new THREE.Matrix4().makeTranslation(x, y - 0.36, zc));
  b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12), M.gold(), new THREE.Matrix4().makeTranslation(x, y - 0.0, zc));
  b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12), M.gold(), new THREE.Matrix4().makeTranslation(x, y - 0.72, zc));
  b.add(new THREE.CylinderGeometry(0.03, 0.05, 0.28, 6), M.gold(), new THREE.Matrix4().makeTranslation(x, y - 0.9, zc));
};

// ---------------- the town ----------------
const inSquareGap = (x: number) => x > 12.5 && x < 35.5;
export const buildTown = (root: THREE.Object3D) => {
  const b = new Batch(), r = rng(21), kit: Kit = {};
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
  buildCanal(b); buildBridge(b);
  for (const bank of [-1, 1]) {
    const yaw = bank > 0 ? Math.PI : 0;
    for (const sx of [-1, 1]) {
      let x = 3.6;
      while (x < 90) {
        const w = pick([6, 7, 8, 9]), h = pick([5.4, 6.2, 7.0]), cx = sx * (x + w / 2);
        if (!(bank > 0 && inSquareGap(cx))) jnHouse(b, cx, bank * 13.5, yaw, w, 7, h, Math.floor(r() * 997));
        if (r() < 0.6) lantern(b, cx + U(r, -1.5, 1.5), D0 + 3.1, bank * 9.9, 0.55, -bank);
        x += w + (r() < 0.2 ? 1.6 : 0.15);
      }
    }
    for (const zf of [24, 34, 46]) for (const sx of [-1, 1]) { // back rows (skyline)
      let x = 2 + r() * 3;
      while (x < 90) {
        const w = pick([7, 8, 9]), h = pick([5.8, 6.6, 7.4]), cx = sx * (x + w / 2), cz = bank * (zf + U(r, 0, 3));
        const inSq = bank > 0 && cx > 9 && cx < 39 && cz < 40;
        if (!inSq && r() > 0.15) jnHouse(b, cx, cz, yaw, w, 8, h, Math.floor(r() * 997));
        x += w + 0.5 + r() * 2.5;
      }
    }
  }
  // the square: house rows on its west, east and north edges, facing in
  for (let z = 19; z < 36; z += 8) { jnHouse(b, 9.0, z, Math.PI / 2, 7.6, 7, pick([5.4, 6.2]), Math.floor(r() * 997)); jnHouse(b, 39.0, z, -Math.PI / 2, 7.6, 7, pick([5.4, 6.2]), Math.floor(r() * 997)); }
  for (let x = 16; x < 34; x += 8) jnHouse(b, x, 38.5, Math.PI, 7.6, 7, pick([6.2, 7.0]), Math.floor(r() * 997));
  for (const [x, z] of [[13.5, 31], [34.5, 31], [13.5, 13], [34.5, 13]] as const) prop(b, kit, pick(["tree_oak", "tree_fat", "tree_default"]), x, D0, z, 6.5, x);
  for (const [x, z] of [[14, 23], [34, 23], [14, 27], [34, 27]] as const) lantern(b, x, D0 + 3.0, z, 0.0, 1);
  // quayside trees (willow stand-ins), far hills
  for (const bank of [-1, 1]) for (let x = -80; x <= 80; x += 15) if (Math.abs(x) > 6 && !(bank > 0 && inSquareGap(x))) prop(b, kit, pick(["tree-high-round", "tree_default", "tree_oak"]), x + U(r, -2, 2), D0, bank * 7.4, 6 + U(r, 0, 2), r() * 6);
  const hill = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  ([[-300, 260, 220, 70, 120], [180, 330, 260, 90, 140], [420, 120, 190, 60, 120], [-420, -150, 210, 64, 150], [-60, -360, 260, 70, 140], [320, -300, 220, 66, 130], [560, -40, 170, 55, 120], [-560, 80, 200, 60, 140]] as const)
    .forEach(([x, z, sx, sy, sz], i) => b.add(hill, M.hill(i), new THREE.Matrix4().compose(V(x, D0 - 3, z), new THREE.Quaternion(), V(sx, sy, sz))));
  b.build(root);
};

// ---------------- the square: stall, abacus ----------------
export const buildStall = (root: THREE.Object3D, at: [number, number, number]) => {
  const b = new Batch(), [x, y, z] = at;
  b.add(boxGeo(V(x - 0.8, y + 0.78, z - 0.38), V(x + 0.8, y + 0.85, z + 0.38)), M.woodRed());
  b.add(boxGeo(V(x - 0.82, y + 0.25, z - 0.4), V(x + 0.82, y + 0.8, z - 0.36)), M.cloth());                               // table cloth front
  for (const sx of [-0.74, 0.74]) for (const sz of [-0.32, 0.32]) b.add(boxGeo(V(x + sx - 0.04, y, z + sz - 0.04), V(x + sx + 0.04, y + 0.78, z + sz + 0.04)), M.wood());
  // banner on a pole beside the table (cloth faces the lens at -z)
  b.add(new THREE.CylinderGeometry(0.035, 0.045, 3.1, 8).translate(x + 1.05, y + 1.55, z + 0.25), M.wood());
  b.add(boxGeo(V(x + 0.8, y + 2.95, z + 0.22), V(x + 1.5, y + 3.0, z + 0.28)), M.wood());
  b.add(quad(V(x + 1.48, y + 1.25, z + 0.24), V(x + 0.82, y + 1.25, z + 0.24), V(x + 0.82, y + 2.95, z + 0.24), V(x + 1.48, y + 2.95, z + 0.24)).rotateY(0), M.banner());
  b.build(root);
};
/** abacus lying on the table: frame along x, rods along z; returns the bead meshes per rod (upper first) */
export const abacus = (at: [number, number, number]) => {
  const g = new THREE.Group(), b = new Batch(), [x, y, z] = at, W = 0.36, Dd = 0.26, wood = M.wood();
  b.add(boxGeo(V(x - W / 2, y, z - Dd / 2), V(x + W / 2, y + 0.03, z - Dd / 2 + 0.02)), wood);
  b.add(boxGeo(V(x - W / 2, y, z + Dd / 2 - 0.02), V(x + W / 2, y + 0.03, z + Dd / 2)), wood);
  for (const s of [-1, 1]) b.add(boxGeo(V(x + s * W / 2 - (s > 0 ? 0.02 : 0), y, z - Dd / 2), V(x + s * W / 2 + (s < 0 ? 0.02 : 0), y + 0.03, z + Dd / 2)), wood);
  b.add(boxGeo(V(x - W / 2, y, z - 0.035), V(x + W / 2, y + 0.032, z - 0.02)), wood); // beam
  const beads: THREE.Mesh[][] = [];
  const bead = new THREE.SphereGeometry(1, 12, 8).scale(0.019, 0.016, 0.011);
  const bm = M.woodRed();
  for (let k = 0; k < 7; k++) {
    const rx = x - W / 2 + 0.035 + k * ((W - 0.07) / 6);
    b.add(new THREE.CylinderGeometry(0.003, 0.003, Dd - 0.02, 5).rotateX(Math.PI / 2).translate(rx, y + 0.016, z), lam("jnRod", () => ({ color: "#c9a24e" })));
    const row: THREE.Mesh[] = [];
    for (let j = 0; j < 7; j++) { const m = new THREE.Mesh(bead, bm); m.castShadow = true; m.receiveShadow = true; m.position.set(rx, y + 0.016, 0); row.push(m); g.add(m); }
    beads.push(row);
  }
  b.build(g);
  return { g, beads, rest: (j: number, up: number) => (j < 2 ? z - Dd / 2 + 0.014 + j * 0.022 + up * 0.045 : z + Dd / 2 - 0.014 - (6 - j) * 0.022 - up * 0.032) };
};

// ---------------- the ancestral hall ----------------
export const buildHall = (root: THREE.Object3D, o: [number, number, number]) => {
  const b = new Batch(), [x0, , z0] = o, BW = z0 + 3;
  const fl = new THREE.PlaneGeometry(14, 12); fl.rotateX(-Math.PI / 2); fl.translate(x0, 0, z0 - 3);
  const fuv = fl.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 3.5, fuv.getY(i) * 3);
  b.add(fl, lam("jnFloor", () => ({ map: woodTex("floor", "#8a5a3a") })));
  // back wall: plaster above, dark wood wainscot below, a beam and the eave on top
  b.add(quad(V(x0 + 7, 0.95, BW), V(x0 - 7, 0.95, BW), V(x0 - 7, 5.6, BW), V(x0 + 7, 5.6, BW)), lam("jnHallWall", () => ({ map: rep(plasterTex("hall", 4, 4, { win: 0 }), 3.5, 1.2) })));
  b.add(boxGeo(V(x0 - 7, 0, BW - 0.05), V(x0 + 7, 0.95, BW)), M.wood());
  b.add(boxGeo(V(x0 - 7, 4.2, BW - 0.25), V(x0 + 7, 4.5, BW)), M.woodRed());
  for (const cx of [x0 - 3.2, x0 + 3.2]) b.add(new THREE.CylinderGeometry(0.16, 0.18, 5.6, 16).translate(cx, 2.8, BW - 0.3), M.woodRed());
  // altar table, tablet stand, tablets, incense burner, candles
  const [ax, , az] = [x0, 0, z0 + 2.62];
  b.add(boxGeo(V(ax - 1.15, 0.86, az - 0.3), V(ax + 1.15, 0.94, az + 0.3)), M.woodRed());
  b.add(boxGeo(V(ax - 1.1, 0.0, az - 0.27), V(ax + 1.1, 0.86, az + 0.27)), lam("jnAltarCloth", () => ({ color: "#a8322c" })));
  b.add(boxGeo(V(ax - 0.75, 0.94, az + 0.02), V(ax + 0.75, 1.12, az + 0.3)), M.woodRed());
  for (let k = -2; k <= 2; k++) {
    const h = k === 0 ? 0.52 : 0.42;
    b.add(boxGeo(V(ax + k * 0.27 - 0.08, 1.12, az + 0.1), V(ax + k * 0.27 + 0.08, 1.12 + h, az + 0.16)), M.black());
    b.add(boxGeo(V(ax + k * 0.27 - 0.06, 1.16, az + 0.095), V(ax + k * 0.27 + 0.06, 1.08 + h, az + 0.1)), M.gold());
  }
  b.add(new THREE.CylinderGeometry(0.13, 0.1, 0.16, 16).translate(ax, 1.02, az - 0.12), M.bronze());
  const flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 2.6, 0.8) });
  for (const s of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10).translate(ax + s * 0.62, 1.09, az - 0.12), lam("jnCandle", () => ({ color: "#d8342e" })));
    b.add(new THREE.SphereGeometry(0.03, 10, 8).scale(1, 1.8, 1).translate(ax + s * 0.62, 1.29, az - 0.12), flame);
  }
  b.add(quad(V(ax + 0.42, 1.6, BW - 0.02), V(ax - 0.42, 1.6, BW - 0.02), V(ax - 0.42, 3.75, BW - 0.02), V(ax + 0.42, 3.75, BW - 0.02)), M.scroll());
  // lattice window (screen left of the altar = +x)
  b.add(quad(V(x0 + 3.0, 1.25, BW - 0.04), V(x0 + 1.75, 1.25, BW - 0.04), V(x0 + 1.75, 2.6, BW - 0.04), V(x0 + 3.0, 2.6, BW - 0.04)), M.lattice());
  // cupboard (screen right = -x): frame, shelves, bowl stacks
  const c = { x0: x0 - 3.6, x1: x0 - 2.0, top: 1.9, z: z0 + 2.48 };
  const wd = M.wood();
  b.add(boxGeo(V(c.x0, 0, c.z + 0.18), V(c.x1, c.top, c.z + 0.3)), wd);
  for (const s of [c.x0, c.x1 - 0.06]) b.add(boxGeo(V(s, 0, c.z - 0.3), V(s + 0.06, c.top, c.z + 0.3)), wd);
  for (const y of [0.1, 0.72, 1.32]) b.add(boxGeo(V(c.x0, y, c.z - 0.3), V(c.x1, y + 0.05, c.z + 0.3)), wd);
  b.add(boxGeo(V(c.x0 - 0.04, c.top - 0.06, c.z - 0.33), V(c.x1 + 0.04, c.top, c.z + 0.33)), wd);
  const bowl = bowlGeo();
  for (const [y, n] of [[0.77, 4], [1.37, 3]] as const) for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++)
    b.add(bowl, M.porcelain(), new THREE.Matrix4().makeTranslation(c.x0 + 0.25 + i * 0.36, y + k * 0.05, c.z - 0.05));
  // two armchairs
  for (const s of [1]) { // (the chair on the cupboard side would stand in the falling bowl's path)
    const cx = ax + s * 1.75, cz = az - 0.35;
    b.add(boxGeo(V(cx - 0.3, 0.45, cz - 0.28), V(cx + 0.3, 0.52, cz + 0.28)), M.woodRed());
    b.add(boxGeo(V(cx - 0.3, 0.52, cz + 0.22), V(cx + 0.3, 1.15, cz + 0.28)), M.woodRed());
    for (const dx of [-0.26, 0.26]) for (const dz of [-0.24, 0.24]) b.add(boxGeo(V(cx + dx - 0.03, 0, cz + dz - 0.03), V(cx + dx + 0.03, 0.45, cz + dz + 0.03)), M.woodRed());
  }
  b.build(root);
};
/** porcelain rice bowl, foot at y = 0 */
let _bowl: THREE.BufferGeometry | null = null;
export const bowlGeo = () => {
  if (!_bowl) {
    const pts = [[0.0, 0.0], [0.045, 0.0], [0.05, 0.012], [0.06, 0.016], [0.1, 0.05], [0.12, 0.085], [0.112, 0.088], [0.092, 0.055], [0.045, 0.028], [0.0, 0.026]].map(([a, c]) => new THREE.Vector2(a, c));
    _bowl = new THREE.LatheGeometry(pts, 28);
  }
  return _bowl;
};

// ---------------- gears ----------------
export const gearGeo = (Ro = 1.6, Rr = 1.28, N = 12, depth = 0.42) => {
  const s = new THREE.Shape();
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, h = Math.PI / N;
    const pts: [number, number][] = [[Rr, a - h * 0.95], [Rr, a - h * 0.55], [Ro, a - h * 0.32], [Ro, a + h * 0.32], [Rr, a + h * 0.55], [Rr, a + h * 0.95]];
    pts.forEach(([r, t], k) => (i === 0 && k === 0 ? s.moveTo(r * Math.cos(t), r * Math.sin(t)) : s.lineTo(r * Math.cos(t), r * Math.sin(t))));
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.22, 0, Math.PI * 2, true); s.holes.push(hole);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2, hp = new THREE.Path(); hp.absarc(0.78 * Math.cos(a), 0.78 * Math.sin(a), 0.24, 0, Math.PI * 2, true); s.holes.push(hp); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.6);
  return g;
};
export { tri };
