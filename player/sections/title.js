// Title / cold-open scene.
import { el, countUp } from "../format.js";
import { sceneShell } from "./shell.js";

export function renderTitle(section, ctx) {
  const { root, inner } = sceneShell(section, ctx);

  inner.append(el("p", { class: "kicker", "data-animate": "" }, section.kicker || "Weekly briefing"));
  inner.append(el("h1", { class: "scene-title", "data-animate": "" }, section.title || ""));
  if (section.subtitle) {
    inner.append(el("p", { class: "scene-sub", "data-animate": "" }, section.subtitle));
  }

  if (section.stats?.length) {
    const row = el("div", { class: "title-stats" });
    for (const stat of section.stats) {
      const num = el("span", { class: "num" }, "0");
      row.append(
        el("div", { class: "title-stat", "data-animate": "" },
          num,
          el("span", { class: "lbl" }, stat.label || ""),
        ),
      );
      // Count up once the stat card fades in.
      const delay = 700 + row.children.length * 250;
      setTimeout(() => countUp(num, stat.value ?? 0, { suffix: stat.suffix || "" }), delay);
    }
    inner.append(row);
  }

  if (section.chips?.length) {
    const row = el("div", { class: "chip-row" });
    inner.append(row);
    for (const chip of section.chips) {
      row.append(el("span", { class: "chip", "data-animate": "" }, chip));
    }
  }

  return root;
}
