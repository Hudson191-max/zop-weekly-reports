// Build a week: validate data/weeks/<id>.json, generate narration audio
// (skipped when the toolchain is missing), report what to do next.
//
// Usage: node build/generate.js <weekId> [--skip-tts]
// e.g.:  node build/generate.js 2026-W40

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateWeek, printValidation } from "./lib/validate.js";
import { generateAudio, ttsAvailable } from "./tts.js";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Register the week in data/weeks/index.json so the player's picker sees it. */
async function upsertWeekIndex(weekId) {
  const idxFile = join(ROOT, "data", "weeks", "index.json");
  let weeks = [];
  try {
    weeks = JSON.parse(await readFile(idxFile, "utf8")).weeks || [];
  } catch { /* first week */ }
  if (!weeks.includes(weekId)) weeks.push(weekId);
  weeks.sort();
  await writeFile(idxFile, JSON.stringify({ weeks }, null, 2) + "\n");
}

const weekId = process.argv[2];
const skipTts = process.argv.includes("--skip-tts");

if (!weekId || !/^\d{4}-W\d{2}$/.test(weekId)) {
  console.error("Usage: node build/generate.js <weekId>   e.g. 2026-W40");
  process.exit(1);
}

const file = join(ROOT, "data", "weeks", `${weekId}.json`);
let raw;
try {
  raw = await readFile(file, "utf8");
} catch {
  console.error(`✗ Not found: ${file}`);
  console.error(`  Create it first: node build/new-week.js ${weekId}`);
  process.exit(1);
}

let week;
try {
  week = JSON.parse(raw);
} catch (e) {
  console.error(`✗ ${file} is not valid JSON: ${e.message}`);
  process.exit(1);
}

console.log(`Validating ${weekId}…`);
const result = validateWeek(week, { file: `${weekId}.json` });
if (!printValidation(result, weekId)) process.exit(1);
await upsertWeekIndex(weekId);

if (result.warnings.length) {
  console.log("  (warnings don't block the build — fix them when you can)");
}

console.log(`Narration: ${ttsAvailable() ? "J.A.R.V.I.S venv found" : "venv missing"}`);
if (!skipTts) {
  console.log("Generating TTS audio…");
  const { skipped } = await generateAudio(week);
  if (skipped) {
    console.log("  → Player will fall back to browser speech synthesis.");
  }
} else {
  console.log("Skipping TTS (--skip-tts).");
}

const scenes = week.sections.length;
console.log(`\nDone. ${scenes} scenes ready.`);
console.log(`Preview:  npm run serve   →  http://localhost:8080/?week=${weekId}`);
