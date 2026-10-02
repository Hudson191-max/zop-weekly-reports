// Scene renderers, one per section type. Registry: type -> render(section, ctx).
// Every renderer returns the scene root element; entrance animation is driven
// by [data-animate] markers + revealStaggered() from the engine.

import { el, countUp, fmtNum } from "../format.js";
import { sceneShell, headingBlock } from "./shell.js";
import { renderTitle } from "./title.js";
import { renderScoreboard } from "./scoreboard.js";
import { renderProjects } from "./projects.js";
import { renderChart } from "./chart.js";
import { renderTimeline } from "./timeline.js";
import { renderWinsBlockers } from "./winsBlockers.js";
import { renderOutlook } from "./outlook.js";
import { renderOutro } from "./outro.js";

export const SECTION_RENDERERS = {
  title: renderTitle,
  scoreboard: renderScoreboard,
  projects: renderProjects,
  chart: renderChart,
  timeline: renderTimeline,
  winsBlockers: renderWinsBlockers,
  outlook: renderOutlook,
  outro: renderOutro,
};

export function renderSection(section, ctx) {
  const renderer = SECTION_RENDERERS[section.type];
  if (!renderer) {
    // Unknown type: degrade gracefully instead of crashing the report.
    const { root, inner } = sceneShell(section, ctx);
    inner.append(
      el("p", { class: "kicker" }, `Unknown section type: ${section.type}`),
      el("h2", { class: "scene-title" }, section.heading || section.label || "—"),
    );
    return root;
  }
  return renderer(section, ctx);
}

export { el, countUp, fmtNum, sceneShell, headingBlock };
