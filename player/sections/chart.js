// Chart scene: bar, line, and donut — hand-rolled SVG, animated with CSS.
import { el, svgEl, fmtNum } from "../format.js";
import { sceneShell, headingBlock } from "./shell.js";
import { prefersReducedMotion } from "../format.js";

const PALETTE = ["#5865f2", "#ffb020", "#2fa96c", "#8b5cf6", "#e05656", "#3b44c0", "#9aa0c7"];
const W = 760, H = 340, M = { top: 26, right: 10, bottom: 34, left: 10 };

function niceMax(v) {
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

function baseSvg() {
  const svg = svgEl("svg", { class: "chart-svg", viewBox: `0 0 ${W} ${H}`, role: "img" });
  return svg;
}

function renderBar(svg, labels, values, plot) {
  const yMax = niceMax(Math.max(...values, 1));
  const slot = plot.w / values.length;
  const barW = Math.min(64, slot * 0.6);

  // gridlines + scale hint
  for (let g = 1; g <= 3; g++) {
    const y = plot.y + plot.h - (plot.h * g) / 3;
    svg.append(svgEl("line", { class: "gridline", x1: plot.x, x2: plot.x + plot.w, y1: y, y2: y }));
  }
  svg.append(
    svgEl("text", { class: "axis-label", x: plot.x + plot.w, y: plot.y - 8, "text-anchor": "end" }, fmtNum(yMax)),
  );

  values.forEach((v, i) => {
    const h = (v / yMax) * plot.h;
    const x = plot.x + slot * i + (slot - barW) / 2;
    const y = plot.y + plot.h - h;
    const rect = svgEl("rect", {
      class: `bar-rect${i === values.length - 1 ? " hot" : ""}`,
      x, y, width: barW, height: Math.max(2, h), rx: 6,
      style: `--d:${(0.15 + i * 0.09).toFixed(2)}s`,
    });
    svg.append(rect);
    svg.append(svgEl("text", {
      class: "bar-value", x: x + barW / 2, y: y - 8, "text-anchor": "middle",
      style: `--d:${(0.55 + i * 0.09).toFixed(2)}s`,
    }, fmtNum(v)));
    svg.append(svgEl("text", {
      class: "axis-label", x: x + barW / 2, y: plot.y + plot.h + 22, "text-anchor": "middle",
      style: `--d:${(0.2 + i * 0.09).toFixed(2)}s`,
    }, labels[i] ?? ""));
  });
}

function renderLine(svg, labels, values, plot) {
  const yMax = niceMax(Math.max(...values, 1));
  const stepX = values.length > 1 ? plot.w / (values.length - 1) : 0;
  const pts = values.map((v, i) => [
    plot.x + stepX * i,
    plot.y + plot.h - (v / yMax) * plot.h,
  ]);

  for (let g = 1; g <= 3; g++) {
    const y = plot.y + plot.h - (plot.h * g) / 3;
    svg.append(svgEl("line", { class: "gridline", x1: plot.x, x2: plot.x + plot.w, y1: y, y2: y }));
  }

  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = svgEl("path", {
    class: "line-area",
    d: `${d} L${pts[pts.length - 1][0]},${plot.y + plot.h} L${pts[0][0]},${plot.y + plot.h} Z`,
  });
  const path = svgEl("path", { class: "line-path", d });
  svg.append(area, path);

  // Draw-on animation needs the rendered path length: set it once mounted.
  if (!prefersReducedMotion) {
    path.style.transition = "none";
    svg._onMounted = () => {
      const len = path.getTotalLength();
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(len);
      path.getBoundingClientRect(); // commit start state
      path.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.25s";
      path.style.strokeDashoffset = "0";
    };
  }

  pts.forEach(([x, y], i) => {
    svg.append(svgEl("circle", {
      class: "line-dot", cx: x, cy: y, r: 5.5,
      style: `--d:${(1.1 + i * 0.12).toFixed(2)}s`,
    }));
    svg.append(svgEl("text", {
      class: "axis-label", x, y: plot.y + plot.h + 22, "text-anchor": "middle",
      style: `--d:${(0.2 + i * 0.09).toFixed(2)}s`,
    }, labels[i] ?? ""));
    svg.append(svgEl("text", {
      class: "bar-value", x, y: y - 14, "text-anchor": "middle",
      style: `--d:${(1.2 + i * 0.12).toFixed(2)}s`,
    }, fmtNum(values[i])));
  });
}

function renderDonut(svg, labels, values) {
  const size = 320, cx = 160, cy = 160, r = 118;
  const C = 2 * Math.PI * r;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;

  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", "320");
  svg.style.maxWidth = "320px";
  svg.style.margin = "0 auto";

  values.forEach((v, i) => {
    const len = Math.max(0, (v / total) * C - 2.5); // small gap between segments
    svg.append(svgEl("circle", {
      class: "donut-seg", cx, cy, r,
      stroke: PALETTE[i % PALETTE.length],
      style: {
        "--len": len.toFixed(2),
        "--rest": (C - len).toFixed(2),
        "--to": (-acc).toFixed(2),
        "--d": `${(0.15 + i * 0.12).toFixed(2)}s`,
      },
    }));
    acc += (v / total) * C;
  });

  const bigIdx = values.indexOf(Math.max(...values));
  svg.append(
    svgEl("text", {
      class: "donut-center-num", x: cx, y: cy + 2, "text-anchor": "middle",
      "data-animate": "",
    }, `${Math.round((values[bigIdx] / total) * 100)}%`),
    svgEl("text", {
      class: "donut-center-lbl", x: cx, y: cy + 28, "text-anchor": "middle",
      "data-animate": "",
    }, labels[bigIdx] ?? ""),
  );
}

export function renderChart(section, ctx) {
  const { root, inner } = sceneShell(section, ctx);
  inner.append(headingBlock(section, "The data"));
  if (section.caption) inner.append(el("p", { class: "scene-caption", "data-animate": "" }, section.caption));

  const chart = section.chart || {};
  const labels = chart.labels || [];
  const values = chart.series?.[0]?.values || [];
  const wrap = el("div", { class: "chart-wrap", "data-animate": "" });
  const svg = baseSvg();
  wrap.append(svg);

  const plot = { x: M.left, y: M.top, w: W - M.left - M.right, h: H - M.top - M.bottom };
  if (chart.kind === "line") renderLine(svg, labels, values, plot);
  else if (chart.kind === "donut") renderDonut(svg, labels, values);
  else renderBar(svg, labels, values, plot);

  // Legend for multi-category charts.
  if (chart.kind === "donut" || (chart.series?.length || 0) > 1) {
    const legend = el("div", { class: "chart-legend" });
    chart.series?.forEach((s, si) => {
      (chart.kind === "donut" ? labels : s.values.map((_, li) => labels[li])).forEach((lbl, li) => {
        const color = chart.kind === "donut" ? PALETTE[li % PALETTE.length] : PALETTE[si % PALETTE.length];
        legend.append(
          el("span", { class: "legend-item" },
            el("span", { class: "legend-dot", style: { background: color } }),
            `${lbl} `,
            el("span", { class: "legend-val" },
              chart.kind === "donut" ? `${values[li]}%` : fmtNum(s.values[li])),
          ),
        );
      });
    });
    wrap.append(legend);
  }

  inner.append(wrap);

  if (!prefersReducedMotion) root._onMounted = () => svg._onMounted?.();
  return root;
}
