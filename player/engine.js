// Scene engine: renders sections as scenes, drives narration, pacing,
// navigation, and the progress/timecode UI.

import { renderSection } from "./sections/index.js";
import { revealStaggered, prefersReducedMotion } from "./format.js";

const HOLD_AFTER_NARRATION_S = 1.4; // breathing room before auto-advance
const MIN_SCENE_S = 5;

export class ReportEngine {
  /**
   * @param {object} week       parsed week JSON
   * @param {import("./audio.js").Narrator} narrator
   */
  constructor(week, narrator) {
    this.week = week;
    this.narrator = narrator;
    this.sections = week.sections || [];
    this.stage = document.getElementById("stage");
    this.ui = {
      progressFill: document.getElementById("progress-fill"),
      progress: document.getElementById("progress"),
      timecode: document.getElementById("timecode"),
      captions: document.getElementById("captions"),
      btnPlay: document.getElementById("btn-play"),
      btnPrev: document.getElementById("btn-prev"),
      btnNext: document.getElementById("btn-next"),
      menuList: document.getElementById("menu-list"),
    };

    this.idx = -1;
    this.playing = false;
    this.handle = null; // active narration handle
    this.holdTimer = null;
    this.raf = null;
    this.captionsOn = true;
    this.ended = false;

    this.durations = this.sections.map((s, i) =>
      Math.max(MIN_SCENE_S, this.narrator.sceneDuration(i, s.narration) + HOLD_AFTER_NARRATION_S),
    );
    this.totalDuration = this.durations.reduce((a, b) => a + b, 0);
  }

  get sceneCount() { return this.sections.length; }
  get toneFor() {
    // Dark/light/dark sandwich: first and last dark, middle light.
    return (i) => this.sections[i]?.tone || (i === 0 || i === this.sceneCount - 1 ? "dark" : "light");
  }

  /* ---------------- rendering ---------------- */

  /**
   * Render scene i; dir = 1 forward (next), -1 backward (prev) drives the
   * directional crossfade. Reduced-motion/export mode swaps instantly.
   */
  renderScene(i, dir = 1) {
    this.narrator.cancel();
    clearTimeout(this.holdTimer);
    cancelAnimationFrame(this.raf);

    const previous = this.stage.firstElementChild;
    const section = this.sections[i];
    const ctx = { index: i, count: this.sceneCount, tone: this.toneFor(i) };
    const root = renderSection(section, ctx);
    this.stage.append(root);
    root._onMounted?.();
    revealStaggered(root);

    if (previous && !prefersReducedMotion) {
      previous.classList.add(dir >= 0 ? "scene-exit-up" : "scene-exit-down");
      previous.addEventListener("animationend", () => previous.remove(), { once: true });
      setTimeout(() => previous.isConnected && previous.remove(), 700); // safety net
      root.classList.add(dir >= 0 ? "scene-enter-up" : "scene-enter-down");
    } else {
      previous?.remove();
    }

    this.idx = i;
    this.ended = false;
    this.handle = null;
    this.updateChromeOnce();
    this.syncMenu();
  }

  /* ---------------- playback ---------------- */

  play(i = this.idx < 0 ? 0 : this.idx, dir = 1) {
    const changed = i !== this.idx;
    if (changed || this.idx < 0) this.renderScene(i, dir);
    this.playing = true;
    this.ended = false;
    this.ui.btnPlay.textContent = "❚❚";
    this.startNarration();
  }

  startNarration() {
    const section = this.sections[this.idx];
    cancelAnimationFrame(this.raf);
    this.handle = this.narrator.speak(this.idx, section?.narration, {
      onProgress: () => this.updateChrome(),
      onEnd: () => this.onSceneEnd(),
    });
    this.tick();
  }

  onSceneEnd() {
    if (!this.playing) return;
    if (this.idx >= this.sceneCount - 1) {
      // Report finished: hold on the outro.
      this.playing = false;
      this.ended = true;
      this.ui.btnPlay.textContent = "▶";
      this.setProgress(1);
      return;
    }
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => this.advance(), HOLD_AFTER_NARRATION_S * 1000);
  }

  advance() {
    if (this.idx < this.sceneCount - 1) this.play(this.idx + 1);
  }

  pause() {
    this.playing = false;
    clearTimeout(this.holdTimer);
    this.narrator.pause();
    cancelAnimationFrame(this.raf);
    this.ui.btnPlay.textContent = "▶";
  }

  toggle() {
    if (this.ended) return this.play(0);
    // Resume at end of last scene = restart it rather than advancing.
    return this.playing ? this.pause() : this.resume();
  }

  resume() {
    this.playing = true;
    this.ui.btnPlay.textContent = "❚❚";
    if (this.handle) {
      this.narrator.resume();
      this.tick();
    } else {
      this.startNarration();
    }
  }

  next() {
    if (this.idx < this.sceneCount - 1) this.play(this.idx + 1, 1);
  }

  prev() {
    if (this.idx > 0) this.play(this.idx - 1, -1);
  }

  goTo(i) {
    if (i === this.idx) return;
    this.play(Math.max(0, Math.min(this.sceneCount - 1, i)), i > this.idx ? 1 : -1);
  }

  seekToFraction(f) {
    let target = f * this.totalDuration;
    for (let i = 0; i < this.sceneCount; i++) {
      if (target <= this.durations[i]) return this.goTo(i);
      target -= this.durations[i];
    }
    this.goTo(this.sceneCount - 1);
  }

  /* ---------------- chrome (progress, captions, menu) ---------------- */

  tick() {
    this.updateChrome();
    if (this.playing) this.raf = requestAnimationFrame(() => this.tick());
  }

  currentElapsed() {
    let sum = 0;
    for (let i = 0; i < this.idx; i++) sum += this.durations[i];
    const handleElapsed = this.handle?.elapsed?.() || 0;
    return sum + Math.min(handleElapsed, this.durations[this.idx] || 0);
  }

  setProgress(f) {
    this.ui.progressFill.style.width = `${(f * 100).toFixed(1)}%`;
    this.ui.progress.setAttribute("aria-valuenow", String(Math.round(f * 100)));
  }

  updateChrome() {
    const elapsed = this.currentElapsed();
    this.setProgress(this.totalDuration ? elapsed / this.totalDuration : 0);
    this.ui.timecode.textContent = `${fmt(elapsed)} / ${fmt(this.totalDuration)}`;
  }

  updateCaptions(text) {
    if (this.captionsOn && text) {
      this.ui.captions.textContent = text;
      this.ui.captions.hidden = false;
    } else {
      this.ui.captions.hidden = true;
    }
  }

  setCaptions(on) {
    this.captionsOn = on;
    document.getElementById("btn-captions").setAttribute("aria-pressed", String(on));
    this.updateCaptions(on ? this.sections[this.idx]?.narration : null);
  }

  syncMenu() {
    this.ui.menuList.querySelectorAll(".menu-item").forEach((btn, i) => {
      btn.classList.toggle("current", i === this.idx);
    });
  }

  buildMenu() {
    this.ui.menuList.replaceChildren();
    this.sections.forEach((s, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "menu-item";
      btn.addEventListener("click", () => {
        this.goTo(i);
        document.getElementById("menu-overlay").hidden = true;
      });
      btn.append(
        Object.assign(document.createElement("span"), { className: "num", textContent: String(i + 1).padStart(2, "0") }),
        document.createTextNode(s.label || s.heading || s.title || `Scene ${i + 1}`),
      );
      li.append(btn);
      this.ui.menuList.append(li);
    });
  }

  updateChromeOnce() {
    const section = this.sections[this.idx];
    this.updateCaptions(section?.narration || null);
    this.updateChrome();
  }
}

function fmt(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
