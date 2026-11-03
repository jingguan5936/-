// prints the frames that use lens blur (dofAt(f).cInf > 0.5)
import { build } from "esbuild";
const r = await build({ entryPoints: ["src/videos/bazi/story.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const m = await import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
const out = []; for (let f = 0; f < m.TOTAL; f++) if (m.dofAt(f).cInf > 0.5) out.push(f);
console.log(out.join(" "));
