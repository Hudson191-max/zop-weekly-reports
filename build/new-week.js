// Scaffold a new week JSON from the section template.
//
// Usage: node build/new-week.js 2026-W41 [--title "…"]

import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const weekId = process.argv[2];
const titleIdx = process.argv.indexOf("--title");
const title = titleIdx > -1 ? process.argv[titleIdx + 1] : null;

if (!weekId || !/^\d{4}-W\d{2}$/.test(weekId)) {
  console.error("Usage: node build/new-week.js <weekId> [--title \"…\"]   e.g. 2026-W41");
  process.exit(1);
}

// Derive a sane Monday→Sunday period from the ISO week + year.
const [year, weekNum] = weekId.split("-W").map(Number);
const jan4 = new Date(Date.UTC(year, 0, 4));
const monday = new Date(jan4);
monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (weekNum - 1) * 7);
const sunday = new Date(monday);
sunday.setUTCDate(monday.getUTCDate() + 6);
const iso = (d) => d.toISOString().slice(0, 10);

const file = join(ROOT, "data", "weeks", `${weekId}.json`);
try {
  await access(file);
  console.error(`✗ Already exists: ${file} (refusing to overwrite)`);
  process.exit(1);
} catch { /* good — file does not exist */ }

const template = {
  week: weekId,
  title: title || `Week ${weekNum} briefing`,
  subtitle: "One line on the shape of the week — the claim, not the topic.",
  period: { start: iso(monday), end: iso(sunday) },
  theme: { accent: "#5865F2", accentAlt: "#FFB020", narrator: "J.A.R.V.I.S" },
  sections: [
    {
      type: "title",
      label: "Opening",
      kicker: `ZOP AI  ·  CLIENT BRIEFING  ·  ${weekId}`,
      title: title || `Week ${weekNum} briefing`,
      subtitle: "What this week was actually about.",
      chips: ["Narrated by J.A.R.V.I.S"],
      stats: [
        { label: "Metric one", value: 0 },
        { label: "Metric two", value: 0 },
        { label: "Metric three", value: 0 },
      ],
      narration: "Cold-open hook here. Start in the middle — a claim, a number, a tease. No throat-clearing.",
    },
    {
      type: "scoreboard",
      label: "Scoreboard",
      heading: "The week in numbers",
      metrics: [
        { label: "Metric name", value: 100, delta: "+0%", good: true, note: "vs last week" },
        { label: "Metric name", value: 50, suffix: "%", delta: "stable", good: true, note: "what it measures" },
      ],
      narration: "The scoreboard story: what changed, why it matters, the sharpest number.",
    },
    {
      type: "projects",
      label: "Build board",
      heading: "What the team shipped",
      items: [
        { name: "Project name", status: "shipped", progress: 100, note: "What it changes for the customer." },
        { name: "Project name", status: "in-progress", progress: 50, note: "Where it stands, what is next." },
      ],
      narration: "The build board story: per project — shipped or not, and the evidence.",
    },
    {
      type: "chart",
      label: "Headline chart",
      heading: "The chart that tells the week",
      caption: "One line of context for the chart.",
      chart: {
        kind: "bar",
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        series: [{ name: "Series", values: [0, 0, 0, 0, 0] }],
      },
      narration: "Walk the chart's shape, then land the one conclusion it proves.",
    },
    {
      type: "timeline",
      label: "The week",
      heading: "The week, day by day",
      events: [
        { day: "Mon", date: "Jan 1", text: "What happened.", tag: "release" },
        { day: "Fri", date: "Jan 5", text: "What happened.", tag: "win" },
      ],
      narration: "The week as a story: day by day, with the turning point named.",
    },
    {
      type: "winsBlockers",
      label: "Wins & blockers",
      heading: "Wins and blockers",
      wins: [{ text: "A concrete win.", note: "Why it matters." }],
      blockers: [{ text: "A concrete blocker.", note: "Who owns it, when it clears." }],
      narration: "The honest part: the wins worth bragging about, the blockers with owners and dates.",
    },
    {
      type: "outlook",
      label: "Next week",
      heading: "Next week's plan",
      items: [{ text: "A commitment.", due: "Thu" }],
      note: "The one-line stakes for next week.",
      narration: "Next week: the commitments, with deadlines, and the stakes if they land.",
    },
    {
      type: "outro",
      label: "Close",
      heading: "End of briefing",
      message: "A quotable last line.",
      highlights: ["+0% metric", "0 incidents"],
      narration: "Button: callback to something earlier, plus what happens next.",
    },
  ],
};

await writeFile(file, JSON.stringify(template, null, 2) + "\n");
console.log(`✓ Scaffolded ${file}`);
console.log(`  Next: edit the placeholders (see docs/authoring-guide.md), then:`);
console.log(`        node build/generate.js ${weekId}`);
