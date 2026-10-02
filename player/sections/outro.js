// Outro: closing scene, dark by design (sandwich structure).
import { el } from "../format.js";
import { sceneShell } from "./shell.js";

export function renderOutro(section, ctx) {
  const { root, inner } = sceneShell(section, ctx);

  inner.append(el("p", { class: "kicker", "data-animate": "" }, section.heading || "End of briefing"));
  inner.append(el("p", { class: "outro-message", "data-animate": "" }, section.message || ""));

  if (section.highlights?.length) {
    const row = el("div", { class: "outro-highlights" });
    for (const h of section.highlights) {
      row.append(el("span", { class: "chip", "data-animate": "" }, h));
    }
    inner.append(row);
  }
  return root;
}
