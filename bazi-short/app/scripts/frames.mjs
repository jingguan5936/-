// usage: node scripts/frames.mjs <outDir> <from> <to> <everyNth> [scale] [concurrency]
// renders a frame range with one persistent page per worker (much faster than renderStill per frame)
import fs from "node:fs";
import path from "node:path";
const TMP = path.resolve("remotion-tmp");
fs.mkdirSync(TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { bundle } = await import("@remotion/bundler");
const { renderFrames, selectComposition } = await import("@remotion/renderer");
const [outDir, from, to, nth, scale = "0.5", conc = "3"] = process.argv.slice(2);
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: process.env.GL || "swangle" };
const inputProps = JSON.parse(process.env.PROPS || "{}");
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "BaziShort", browserExecutable, chromiumOptions, inputProps });
fs.mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
await renderFrames({ composition, serveUrl, outputDir: outDir, inputProps, imageFormat: "jpeg", jpegQuality: 88, frameRange: [Number(from), Number(to)],
  everyNthFrame: Number(nth), concurrency: Number(conc), scale: Number(scale), browserExecutable, chromiumOptions, timeoutInMilliseconds: 900000,
  onStart: ({ frameCount }) => console.log("frames", frameCount),
  onFrameUpdate: (n) => { if (n % 5 === 0) console.log("done", n, ((Date.now() - t0) / 1000).toFixed(0) + "s"); },
  onBrowserLog: (l) => { if (l.type === "error") console.log("[err]", l.text.slice(0, 300)); } });
console.log("total", ((Date.now() - t0) / 1000).toFixed(0) + "s");
