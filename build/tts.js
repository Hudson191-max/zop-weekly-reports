// TTS generation: narration text -> MP3s + duration manifest via edge-tts
// running in the J.A.R.V.I.S venv. Skips gracefully if the toolchain is absent.

import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const VENV_PY = process.env.JARVIS_PY ||
  "C:/Users/DjDri/OneDrive/Bureaublad/projects/J.A.R.V.I.S/.venv/Scripts/python.exe";
export const VOICE = process.env.TTS_VOICE || "en-GB-RyanNeural";

export function ttsAvailable() {
  return existsSync(VENV_PY);
}

/** Run edge-tts for one text -> mp3 file. Resolves when the file is written. */
export function synthesize(text, outFile) {
  return new Promise((resolve, reject) => {
    const py = spawn(VENV_PY, [
      "-c",
      `import asyncio, edge_tts; asyncio.run(edge_tts.Communicate(${JSON.stringify(text)}, ${JSON.stringify(VOICE)}).save(${JSON.stringify(outFile)}))`,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    py.stderr.on("data", (d) => (err += d));
    py.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `edge-tts exited ${code}`))));
    py.on("error", reject);
  });
}

/** ffprobe duration in seconds (rounded to 2 decimals), or null. */
export function ffprobeDuration(file) {
  const r = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
  ], { encoding: "utf8" });
  const v = parseFloat(r.stdout?.trim());
  return Number.isFinite(v) ? v : null;
}

/**
 * Generate narration audio for a week.
 * @returns {Promise<{manifest: object|null, skipped: boolean}>}
 */
export async function generateAudio(week) {
  const audioDir = join(ROOT, "audio", week.week);
  await mkdir(audioDir, { recursive: true });

  if (!ttsAvailable()) {
    console.warn("  ⚠ J.A.R.V.I.S venv not found — skipping TTS. Player will use browser voices.");
    return { manifest: null, skipped: true };
  }

  const scenes = [];
  for (let i = 0; i < week.sections.length; i++) {
    const text = week.sections[i]?.narration;
    if (!text) { scenes.push({ index: i }); continue; }
    const file = `scene${String(i).padStart(2, "0")}.mp3`;
    process.stdout.write(`  … scene ${i + 1}/${week.sections.length}\r`);
    try {
      await synthesize(text, join(audioDir, file));
    } catch (e) {
      console.warn(`  ⚠ TTS failed for scene ${i}: ${e.message}`);
      scenes.push({ index: i });
      continue;
    }
    const duration = ffprobeDuration(join(audioDir, file));
    scenes.push({ index: i, file, duration: duration ?? undefined, text });
  }
  console.log("");

  const manifest = { week: week.week, voice: VOICE, generated: new Date().toISOString(), scenes };
  await writeFile(join(audioDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`  ✓ wrote ${join(audioDir, "manifest.json")}`);
  return { manifest, skipped: false };
}
