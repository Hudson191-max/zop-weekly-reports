// Scoreboard: big number cards.
import { el, countUp } from "../format.js";
import { sceneShell, headingBlock } from "./shell.js";

export function renderScoreboard(section, ctx) {
  const { root, inner } = sceneShell(section, ctx);
  inner.append(headingBlock(section, "The scoreboard"));

  const grid = el("div", { class: "metrics-grid" });
  inner.append(grid);

  section.metrics?.forEach((metric, i) => {
    const numNode = el("span", {}, "0");
    const suffix = metric.suffix ? el("span", { class: "suffix" }, metric.suffix) : null;
    const card = el("div", { class: "metric-card", "data-animate": "" },
      el("div", { class: "metric-label" }, metric.label || ""),
      el("div", { class: "metric-value" }, numNode, suffix),
      metric.delta
        ? el("div", { class: `metric-delta${metric.good === false ? " bad" : ""}` },
            /^[+\-−]/.test(metric.delta) ? (metric.good === false ? "▾ " : "▴ ") : "",
            metric.delta)
        : null,
      metric.note ? el("div", { class: "metric-note" }, metric.note) : null,
    );
    grid.append(card);
    setTimeout(() => countUp(numNode, metric.value ?? 0), 500 + i * 180);
  });

  return root;
}
