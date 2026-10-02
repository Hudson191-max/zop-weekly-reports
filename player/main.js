// Player bootstrap: load week data (+ audio manifest if present), wire the
// start gate and all HUD controls, hand off to the scene engine.

import { Narrator } from "./audio.js";
import { ReportEngine } from "./engine.js";

const $ = (id) => document.getElementById(id);

function weekIdFromUrl() {
  const param = new URLSearchParams(location.search).get("week");
  return param ? param.replace(/[^a-zA-Z0-9\-_]/g, "") : "2026-W40";
}

// Video-export mode: /?scene=3&mute — skip the gate, open on one scene, silent.
const exportParams = new URLSearchParams(location.search);
const EXPORT_SCENE = exportParams.has("scene") ? Number(exportParams.get("scene")) : null;
if (EXPORT_SCENE != null) document.documentElement.classList.add("export");

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function gateError(message) {
  $("gate-title").textContent = "Something went wrong";
  $("gate-sub").textContent = message;
  $("btn-start").disabled = true;
}

async function main() {
  const weekId = weekIdFromUrl();

  let week;
  let manifest = null;
  try {
    week = await fetchJson(`data/weeks/${weekId}.json`);
  } catch {
    gateError(`Could not load report "${weekId}". Check the week id or serve this folder over HTTP.`);
    return;
  }
  try {
    manifest = await fetchJson(`audio/${weekId}/manifest.json`);
  } catch {
    manifest = null; // no generated audio: browser speech synthesis fallback
  }

  const period = week.period ? `${week.period.start} → ${week.period.end}` : "";
  $("gate-kicker").textContent = `ZOP AI · WEEKLY BRIEFING · ${weekId}`;
  $("gate-title").textContent = week.title || "Weekly briefing";
  $("gate-sub").textContent =
    (manifest ? "Narrated by " + (week.theme?.narrator || "J.A.R.V.I.S") + " · " : "") + period;

  const narrator = new Narrator(weekId, manifest);
  const engine = new ReportEngine(week, narrator);
  engine.buildMenu();
  engine.updateCaptions("");

  const start = () => {
    $("gate").hidden = true;
    if (EXPORT_SCENE != null && Number.isInteger(EXPORT_SCENE)) {
      // Video export: clean frames — no HUD, no captions, silent, settled scene.
      engine.play(Math.max(0, Math.min(engine.sceneCount - 1, EXPORT_SCENE)));
      engine.narrator.setMuted(true);
      engine.setCaptions(false);
      setTimeout(() => engine.pause(), 300);
    } else {
      $("topbar").hidden = false;
      $("controls").hidden = false;
      $("hud-week").textContent = weekId;
      $("hud-title").textContent = week.title || "";
      engine.play(0);
    }
  };

  if (EXPORT_SCENE != null && Number.isInteger(EXPORT_SCENE)) {
    start(); // video-export mode: no gate, no interaction
  } else {
    $("btn-start").disabled = false;
    $("btn-start").textContent = manifest ? "▶  Play the briefing" : "▶  Play the briefing (browser voice)";
    $("btn-start").addEventListener("click", start);
  }

  // Driving hook for QA automation and the video exporter (build/video/).
  window.__zopEngine = engine;

  /* ---- HUD wiring ---- */
  $("btn-play").addEventListener("click", () => engine.toggle());
  $("btn-next").addEventListener("click", () => engine.next());
  $("btn-prev").addEventListener("click", () => engine.prev());

  $("progress").addEventListener("click", (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    engine.seekToFraction((e.clientX - rect.left) / rect.width);
  });

  $("btn-captions").addEventListener("click", () => {
    const on = $("btn-captions").getAttribute("aria-pressed") !== "true";
    engine.setCaptions(on);
  });

  function toggleMenu(force) {
    const overlay = $("menu-overlay");
    overlay.hidden = force !== undefined ? !force : !overlay.hidden;
  }
  $("btn-menu").addEventListener("click", () => toggleMenu());
  $("btn-menu-close").addEventListener("click", () => toggleMenu(false));
  $("menu-overlay").addEventListener("click", (e) => {
    if (e.target === $("menu-overlay")) toggleMenu(false);
  });

  function setMuted(muted) {
    narrator.setMuted(muted);
    const btn = $("btn-mute");
    btn.textContent = muted ? "🔇" : "🔊";
    btn.setAttribute("aria-pressed", String(muted));
  }
  $("btn-mute").addEventListener("click", () => setMuted(!narrator.muted));

  document.addEventListener("keydown", (e) => {
    if ($("gate").hidden === false) {
      if (e.key === "Enter" || e.key === " ") start();
      return;
    }
    switch (e.key) {
      case "ArrowRight": case "PageDown": engine.next(); break;
      case "ArrowLeft": case "PageUp": engine.prev(); break;
      case " ": case "Enter": e.preventDefault(); engine.toggle(); break;
      case "Home": engine.goTo(0); break;
      case "End": engine.goTo(engine.sceneCount - 1); break;
      case "m": case "M": setMuted(!narrator.muted); break;
      case "c": case "C": engine.setCaptions(!engine.captionsOn); break;
      case "Escape": toggleMenu(false); break;
    }
  });
}

main();
