// Narration audio: pre-generated MP3s when a manifest exists, otherwise
// browser SpeechSynthesis. Also owns caption text and the mute/caption state.

const ESTIMATED_WPS = 2.7; // ~160 words/min, used when no MP3 duration is known
const HOLD_SILENCE_S = 1.0; // pacing when a scene has no narration at all

export function estimateDuration(text) {
  if (!text) return HOLD_SILENCE_S;
  return Math.max(3, text.trim().split(/\s+/).length / ESTIMATED_WPS + 0.6);
}

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const byName = (re) => voices.find((v) => re.test(v.name));
  return (
    (byName(/en-GB/i) && (byName(/(ryan|daniel|george|arthur)/i) || byName(/en-GB/i))) ||
    voices.find((v) => /^en(-|_)/i.test(v.lang)) ||
    voices[0]
  );
}

export class Narrator {
  constructor(weekId, manifest) {
    this.weekId = weekId;
    this.manifest = manifest; // null => speech-synthesis fallback mode
    this.muted = false;
    this._handle = null;
    if ("speechSynthesis" in window) {
      speechSynthesis.onvoiceschanged = () => {};
      speechSynthesis.getVoices();
    }
  }

  get mode() {
    return this.manifest ? "mp3" : "speech";
  }

  sceneDuration(index, narrationText) {
    const entry = this.manifest?.scenes?.[index];
    return entry?.duration ?? estimateDuration(narrationText);
  }

  /**
   * Start narration for a scene.
   * @returns {{elapsed: () => number, duration: number, pause: () => void,
   *            resume: () => void, cancel: () => void}} plus completion via onEnd
   */
  speak(index, text, { onProgress, onEnd }) {
    this.cancel();
    const handle = { cancelled: false, elapsed: 0, lastTick: 0 };
    const duration = this.sceneDuration(index, text);
    this._handle = handle;

    const finish = () => {
      if (handle.cancelled) return;
      onProgress?.(1);
      onEnd?.();
    };

    if (!text) {
      // No narration for this scene: hold briefly, then let the engine advance.
      handle.duration = HOLD_SILENCE_S;
      handle.timer = setTimeout(finish, HOLD_SILENCE_S * 1000);
      handle.elapsed = () => handle.timer ? HOLD_SILENCE_S : 0;
      handle.pause = () => {};
      handle.resume = () => {};
      handle.cancel = () => { handle.cancelled = true; clearTimeout(handle.timer); };
      return handle;
    }

    const entry = this.manifest?.scenes?.[index];
    if (entry?.file) {
      const audio = new Audio(`audio/${this.weekId}/${entry.file}`);
      audio.preload = "auto";
      audio.muted = this.muted;
      audio.addEventListener("timeupdate", () => {
        onProgress?.(Math.min(1, audio.currentTime / (audio.duration || duration)));
      });
      audio.addEventListener("ended", finish);
      audio.addEventListener("error", finish); // missing file: don't stall the report
      audio.play().catch(finish);
      handle.duration = entry.duration || duration;
      handle.elapsed = () => audio.currentTime;
      handle.pause = () => audio.pause();
      handle.resume = () => { audio.muted = this.muted; audio.play().catch(finish); };
      handle.cancel = () => { handle.cancelled = true; audio.pause(); audio.src = ""; };
      handle._audio = audio;
    } else {
      // Speech synthesis fallback (or muted mode: silent pacing timer only).
      handle.duration = duration;
      handle.startedAt = performance.now();

      const tick = () => {
        if (handle.cancelled || handle.paused) return;
        const t = (performance.now() - handle.startedAt) / 1000;
        handle.elapsedClock = t;
        onProgress?.(Math.min(1, t / duration));
        if (t >= duration) return finish();
        handle.raf = requestAnimationFrame(tick);
      };

      const startClock = () => {
        handle.startedAt = performance.now() - (handle.elapsedClock || 0) * 1000;
        handle.raf = requestAnimationFrame(tick);
      };

      if (this.muted || !("speechSynthesis" in window)) {
        startClock();
      } else {
        const utter = new SpeechSynthesisUtterance(text);
        const voice = pickVoice();
        if (voice) { utter.voice = voice; utter.lang = voice.lang; }
        utter.rate = 1;
        utter.onend = () => { if (!handle.paused) finish(); };
        utter.onerror = () => { if (!handle.paused) finish(); };
        speechSynthesis.speak(utter);
        handle._utter = utter;
        startClock(); // clock runs in parallel; utter.onend usually fires first
      }

      handle.elapsed = () => handle.elapsedClock || 0;
      handle.pause = () => {
        handle.paused = true;
        cancelAnimationFrame(handle.raf);
        if (handle._utter) speechSynthesis.cancel();
      };
      handle.resume = () => {
        handle.paused = false;
        if (this.muted || !("speechSynthesis" in window)) { startClock(); return; }
        const utter = new SpeechSynthesisUtterance(text);
        const voice = pickVoice();
        if (voice) { utter.voice = voice; utter.lang = voice.lang; }
        utter.rate = 1;
        utter.onend = () => { if (!handle.paused) finish(); };
        utter.onerror = () => { if (!handle.paused) finish(); };
        handle._utter = utter;
        speechSynthesis.speak(utter);
        startClock();
      };
      handle.cancel = () => {
        handle.cancelled = true;
        cancelAnimationFrame(handle.raf);
        if (handle._utter) speechSynthesis.cancel();
      };
    }
    return handle;
  }

  pause() { this._handle?.pause?.(); }
  resume() { this._handle?.resume?.(); }

  cancel() {
    if (this._handle) {
      this._handle.cancel?.();
      this._handle = null;
    }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this._handle?._audio) this._handle._audio.muted = muted;
    // Speech mode can't mute an utterance mid-flight; pause/resume recreates it.
  }
}
