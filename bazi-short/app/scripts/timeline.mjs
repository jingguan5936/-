// dumps the picture timeline (story.ts) to ../audio/timeline.json for the sound scripts
import { build } from "esbuild";
import fs from "node:fs";
const r = await build({ entryPoints: ["src/videos/bazi/story.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const mod = await import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
const out = { FPS: mod.FPS, TOTAL: mod.TOTAL, FLASH_AT: mod.FLASH_AT, EV: mod.EV, BOWL_TIP: mod.BOWL_TIP, BOWL_HIT: mod.BOWL_HIT,
  SHOTS: mod.SHOTS.map((s) => ({ id: s.id, a: s.a, b: s.b, light: s.light, set: s.set })), XFADE: mod.XFADE };
fs.writeFileSync("../audio/timeline.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.EV));
