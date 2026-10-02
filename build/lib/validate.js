// Schema validation for week JSON files — dependency-free, friendly errors.

const SECTION_TYPES = ["title", "scoreboard", "projects", "chart", "timeline", "winsBlockers", "outlook", "outro"];
const CHART_KINDS = ["bar", "line", "donut"];
const PROJECT_STATUSES = ["shipped", "in-progress", "at-risk", "planned"];

const errors = [];
const warnings = [];

function check(cond, msg) {
  if (!cond) errors.push(msg);
}

export function validateWeek(week, { file = "week.json" } = {}) {
  errors.length = 0;
  warnings.length = 0;

  check(week && typeof week === "object", `${file}: root must be an object`);
  if (!week || typeof week !== "object") return { ok: false, errors, warnings };

  check(typeof week.week === "string" && /^\d{4}-W\d{2}$/.test(week.week),
    `${file}: "week" must match YYYY-Www (e.g. "2026-W40"), got ${JSON.stringify(week.week)}`);
  check(typeof week.title === "string" && week.title.length > 0, `${file}: "title" is required`);

  if (week.period) {
    check(/^\d{4}-\d{2}-\d{2}$/.test(week.period.start || ""), `${file}: period.start must be YYYY-MM-DD`);
    check(/^\d{4}-\d{2}-\d{2}$/.test(week.period.end || ""), `${file}: period.end must be YYYY-MM-DD`);
  }

  check(Array.isArray(week.sections) && week.sections.length > 0, `${file}: "sections" must be a non-empty array`);
  if (!Array.isArray(week.sections)) return { ok: false, errors, warnings };

  week.sections.forEach((s, i) => {
    const at = `sections[${i}] (${s?.type || "?"})`;
    check(typeof s.type === "string", `${at}: "type" is required`);
    if (!SECTION_TYPES.includes(s.type)) {
      errors.push(`${at}: unknown type "${s.type}". Allowed: ${SECTION_TYPES.join(", ")}`);
      return;
    }
    if (!s.narration) warnings.push(`${at}: no narration text — scene will play silently`);

    switch (s.type) {
      case "title":
        check(typeof s.title === "string" && s.title.length > 0, `${at}: "title" is required`);
        break;
      case "scoreboard":
        check(Array.isArray(s.metrics) && s.metrics.length > 0, `${at}: "metrics" must be a non-empty array`);
        s.metrics?.forEach((m, j) => {
          check(typeof m.value === "number", `sections[${i}].metrics[${j}]: "value" must be a number`);
          check(typeof m.label === "string", `sections[${i}].metrics[${j}]: "label" is required`);
        });
        break;
      case "projects":
        check(Array.isArray(s.items) && s.items.length > 0, `${at}: "items" must be a non-empty array`);
        s.items?.forEach((p, j) => {
          check(typeof p.name === "string", `sections[${i}].items[${j}]: "name" is required`);
          if (p.status && !PROJECT_STATUSES.includes(p.status)) {
            errors.push(`sections[${i}].items[${j}]: status "${p.status}" not in ${PROJECT_STATUSES.join(", ")}`);
          }
          if (p.progress != null) {
            check(typeof p.progress === "number" && p.progress >= 0 && p.progress <= 100,
              `sections[${i}].items[${j}]: "progress" must be 0–100`);
          }
        });
        break;
      case "chart": {
        const chart = s.chart;
        check(chart && typeof chart === "object", `${at}: "chart" object is required`);
        if (chart) {
          check(CHART_KINDS.includes(chart.kind), `${at}: chart.kind must be one of ${CHART_KINDS.join(", ")}`);
          check(Array.isArray(chart.labels) && chart.labels.length > 0, `${at}: chart.labels is required`);
          check(Array.isArray(chart.series) && chart.series.length > 0 &&
            chart.series.every((sr) => Array.isArray(sr.values)),
            `${at}: chart.series with values is required`);
          if (chart.kind === "donut") {
            const sum = (chart.series?.[0]?.values || []).reduce((a, b) => a + b, 0);
            if (sum > 0 && Math.abs(sum - 100) > 1) {
              warnings.push(`${at}: donut values sum to ${sum}, expected ~100 (they are shown as shares)`);
            }
          }
        }
        break;
      }
      case "timeline":
        check(Array.isArray(s.events) && s.events.length > 0, `${at}: "events" must be a non-empty array`);
        s.events?.forEach((ev, j) => {
          check(typeof ev.text === "string" && ev.text, `sections[${i}].events[${j}]: "text" is required`);
        });
        break;
      case "winsBlockers":
        check((s.wins?.length || 0) + (s.blockers?.length || 0) > 0,
          `${at}: at least one win or blocker is required`);
        break;
      case "outlook":
        check(Array.isArray(s.items) && s.items.length > 0, `${at}: "items" must be a non-empty array`);
        break;
      case "outro":
        check(typeof s.message === "string", `${at}: "message" is recommended`);
        break;
    }
  });

  return { ok: errors.length === 0, errors, warnings };
}

export function printValidation(result, label = "") {
  for (const e of result.errors) console.error(`  ✗ ${e}`);
  for (const w of result.warnings) console.warn(`  ⚠ ${w}`);
  if (result.ok) {
    console.log(`  ✓ ${label} valid` + (result.warnings.length ? ` (${result.warnings.length} warning(s))` : ""));
  } else {
    console.error(`  ✗ ${label} invalid — ${result.errors.length} error(s)`);
  }
  return result.ok;
}
