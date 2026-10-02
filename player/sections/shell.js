// Shared scene chrome: tone, ghost number motif, and the content column.
import { el } from "../format.js";

/**
 * Build the outer scene wrapper.
 * @param {{tone?: "dark"|"light", label?: string}} section
 * @param {{index: number, count: number, tone: string}} ctx
 */
export function sceneShell(section, ctx) {
  const root = el("section", {
    class: `scene ${ctx.tone}`,
    "aria-label": section.label || `Scene ${ctx.index + 1}`,
  });
  const ghost = el("div", { class: "ghost", "aria-hidden": "true" }, String(ctx.index + 1).padStart(2, "0"));
  const inner = el("div", { class: "scene-inner" });
  root.append(ghost, inner);
  return { root, inner };
}

/** Standard kicker + heading block used by most content scenes. */
export function headingBlock(section, kickerText) {
  const frag = document.createDocumentFragment();
  if (kickerText) {
    frag.append(el("p", { class: "kicker", "data-animate": "" }, kickerText));
  }
  if (section.heading) {
    frag.append(el("h2", { class: "scene-title", "data-animate": "" }, section.heading));
  }
  return frag;
}
