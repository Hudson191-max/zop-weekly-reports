// Video export: renders each scene to a still frame (headless Edge/Chrome),
// then assembles a narrated MP4 with ffmpeg — the proven Week-40 recipe
// (per-scene still + MP3, padded tail, concat).
//
// Usage:  node build/video/make-video.js 2026-W40
// Output: reports/Weekly Report 2026-W40.mp4
//
// Requirements: ffmpeg + ffprobe on PATH; Edge or Chrome installed.
// The player itself stays zero-dependency; this is an authoring tool.

import { spawn, spawnSync } from "node:child_process";
import { mkdir, rm, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const PORT = 8123;
const OUT_DIR = join(ROOT, "build", "video", "frames");
const SIZE = "1920,1080";

const weekId = process.argv[2];
if (!weekId || !/^\d{4}-W\d{2}$/.test(weekId)) {
  console.error("Usage: node build/video/make-video.js <weekId>   e.g. 2026-W40");
  process.exit(1);
}

/* ---------- tool detection ---------- */

function findBrowser() {
  const candidates = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    process.env.CHROME_PATH,
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

const BROWSER = findBrowser();
if (!BROWSER) {
  console.error("✗ No Edge/Chrome found for headless rendering (set CHROME_PATH).");
  process.exit(1);
}

/* ---------- static server (same as build/serve.js, in-process) ---------- */

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT)) throw new Error("forbidden");
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[file.slice(file.lastIndexOf("."))] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise((r) => server.listen(PORT, r));

/* ---------- load week + manifest ---------- */

const week = JSON.parse(await readFile(join(ROOT, "data", "weeks", `${weekId}.json`), "utf8"));
let manifest = null;
try { manifest = JSON.parse(await readFile(join(ROOT, "audio", weekId, "manifest.json"), "utf8")); } catch {}

const EST_WPS = 2.7;
const HOLD_AFTER_S = 1.4;
const durationOf = (i) =>
  manifest?.scenes?.[i]?.duration ??
  (week.sections[i]?.narration ? week.sections[i].narration.split(/\s+/).length / EST_WPS + 0.6 : 3) + HOLD_AFTER_S;

/* ---------- render stills ---------- */

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

function shoot(url, outPng) {
  return new Promise((resolve) => {
    // virtual-time-budget fast-forwards timers/transitions so the scene is settled.
    const proc = spawn(BROWSER, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars",
      `--window-size=${SIZE}`, `--screenshot=${outPng}`,
      "--virtual-time-budget=9000", url,
    ], { stdio: "ignore" });
    proc.on("close", resolve);
    proc.on("error", () => resolve());
  });
}

console.log(`Rendering ${week.sections.length} scenes with ${BROWSER.includes("msedge") ? "Edge" : "Chrome"}…`);
for (let i = 0; i < week.sections.length; i++) {
  const png = join(OUT_DIR, `scene${String(i).padStart(2, "0")}.png`);
  process.stdout.write(`  scene ${i + 1}/${week.sections.length}\r`);
  await shoot(`http://localhost:${PORT}/?week=${weekId}&scene=${i}`, png);
}
console.log("");

/* ---------- assemble video ---------- */

await mkdir(join(ROOT, "reports"), { recursive: true });
const concatList = [];

for (let i = 0; i < week.sections.length; i++) {
  const png = join(OUT_DIR, `scene${String(i).padStart(2, "0")}.png`);
  if (!existsSync(png)) { console.warn(`  ⚠ missing frame for scene ${i} — skipping`); continue; }
  const seg = join(OUT_DIR, `seg${String(i).padStart(2, "0")}.mp4`);
  const audio = manifest?.scenes?.[i]?.file ? join(ROOT, "audio", weekId, manifest.scenes[i].file) : null;
  process.stdout.write(`  encoding scene ${i + 1}/${week.sections.length}\r`);
  const args = [
    "-y", "-loop", "1", "-framerate", "30", "-i", png,
    ...(audio ? ["-i", audio] : []),
    "-vf", "scale=1920:1080", "-c:v", "libx264", "-tune", "stillimage", "-crf", "20",
    "-pix_fmt", "yuv420p",
    ...(audio ? ["-af", "apad=pad_dur=1.2", "-c:a", "aac", "-b:a", "160k", "-shortest"]
              : ["-t", durationOf(i).toFixed(2)]),
    seg,
  ];
  const r = spawnSync("ffmpeg", args, { stdio: "pipe" });
  if (r.status !== 0) {
    console.error(`\n  ✗ ffmpeg failed on scene ${i}:\n${r.stderr?.toString().slice(-500)}`);
    process.exit(1);
  }
  concatList.push(`file '${seg.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`);
}

await writeFile(join(OUT_DIR, "list.txt"), concatList.join("\n"));
const outFile = join(ROOT, "reports", `Weekly Report ${weekId}.mp4`);
const concat = spawnSync("ffmpeg", [
  "-y", "-f", "concat", "-safe", "0", "-i", join(OUT_DIR, "list.txt"),
  "-c", "copy", outFile,
], { stdio: "pipe" });
if (concat.status !== 0) {
  console.error(`✗ concat failed:\n${concat.stderr?.toString().slice(-500)}`);
  process.exit(1);
}

server.close();
console.log(`\n✓ Wrote ${outFile}`);

// Also drop a copy on the Desktop, like the Week-40 deliveries.
const desktop = "C:/Users/DjDri/OneDrive/Bureaublad";
if (existsSync(desktop)) {
  await copyFile(outFile, join(desktop, `Weekly Report ${weekId}.mp4`));
  console.log(`✓ Copy on Desktop`);
}
