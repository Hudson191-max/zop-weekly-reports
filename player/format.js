// Small shared helpers for scene renderers.

// Video-export screenshots run under virtual time where rAF never fires,
// so export mode forces every animation to its final state.
const EXPORT_MODE = new URLSearchParams(location.search).has("scene");

export const prefersReducedMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches || EXPORT_MODE;

/** Create an element with attributes, class list, and children in one call. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") {
      for (const [prop, val] of Object.entries(v)) node.style.setProperty(prop, val);
    }
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

/** SVG element creator (needs its own namespace); takes children like el(). */
export function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") node.setAttribute("class", v);
    else if (k === "style" && typeof v === "object") {
      for (const [prop, val] of Object.entries(v)) node.style.setProperty(prop, val);
    } else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

/** Locale-safe number formatting: 12847 -> "12,847". */
export function fmtNum(n) {
  return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Count a number up over ~900ms with ease-out, preserving decimals. */
export function countUp(node, target, { duration = 900, suffix = "" } = {}) {
  const decimals = Number.isInteger(target) ? 0 : (String(target).split(".")[1]?.length ?? 2);
  const text = () =>
    (node.textContent =
      (target).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix);
  if (prefersReducedMotion) return text();
  const start = performance.now();
  const from = 0;
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = from + (target - from) * eased;
    node.textContent =
      v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/**
 * Stagger-reveal all [data-animate] descendants by adding .played to the
 * scene root; each element's delay is set as --d inline custom property.
 * Returns total reveal time in ms (for pacing), 0 when reduced motion.
 */
export function revealStaggered(sceneRoot, step = 90, base = 120) {
  const items = sceneRoot.querySelectorAll("[data-animate]");
  items.forEach((node, i) => node.style.setProperty("--d", `${(base + i * step) / 1000}s`));
  // Double rAF so the initial (hidden) state is committed before transitioning.
  requestAnimationFrame(() => requestAnimationFrame(() => sceneRoot.classList.add("played")));
  return prefersReducedMotion ? 0 : base + items.length * step + 550;
}
