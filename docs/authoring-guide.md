# Authoring guide — weekly reports

Everything a week needs lives in **one JSON file**: `data/weeks/YYYY-Www.json`. The player reads it; `node build/generate.js <week>` validates it and generates narration audio.

Write narration text for the ear (the J.A.R.V.I.S persona): one idea per sentence, numbers as drama ("Fifty-eight. Forty-one. Nine."), no throat-clearing cold opens, a quotable last line. If a sentence reads like a slide bullet read aloud, rewrite it.

## Top-level fields

| Field | Required | Notes |
| --- | --- | --- |
| `week` | yes | `YYYY-Www`, e.g. `2026-W41` |
| `title` | yes | Big title on the opening scene and start gate |
| `subtitle` | no | One line under the title |
| `period` | no | `{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }` |
| `theme.accent` / `theme.accentAlt` | no | Hex colors (default blurple `#5865F2` / amber `#FFB020`) |
| `theme.narrator` | no | Name shown on the start gate (default `J.A.R.V.I.S`) |
| `sections` | yes | Array of scenes, played in order |

Every section accepts an optional **`label`** (scene-menu name), **`narration`** (spoken text), and **`tone`** (`"dark"` or `"light"` — default is a dark/light/dark sandwich: first and last scenes dark).

## Section types

### `title` — cold open
```json
{
  "type": "title",
  "kicker": "Z.AI · CLIENT BRIEFING · 2026-W41",
  "title": "The headline claim",
  "subtitle": "One line on the shape of the week.",
  "chips": ["Narrated by J.A.R.V.I.S"],
  "stats": [{ "label": "Tasks automated", "value": 12847 }]
}
```
Stats count up when the scene plays.

### `scoreboard` — big numbers
```json
{
  "type": "scoreboard",
  "heading": "The week in numbers",
  "metrics": [
    { "label": "Support tickets", "value": 214, "delta": "−31%", "good": true, "note": "opened this week" },
    { "label": "Uptime", "value": 99.98, "suffix": "%", "delta": "stable" }
  ]
}
```
`value` may be a decimal (2 fraction digits max). `delta` gets an up arrow unless `good: false` (down arrow, red) or it doesn't start with `+`/`−` (no arrow).

### `projects` — build board
```json
{
  "type": "projects",
  "heading": "What the team shipped",
  "items": [
    { "name": "Smart Triage v2", "status": "shipped", "progress": 100, "note": "Live Tuesday." },
    { "name": "Audit export", "status": "at-risk", "progress": 45, "note": "Redesign lands Monday." }
  ]
}
```
`status`: `shipped` | `in-progress` | `at-risk` | `planned`. `progress` 0–100 drives the animated bar.

### `chart` — bar, line, or donut
```json
{
  "type": "chart",
  "heading": "Tickets handled per day",
  "caption": "Human-touch tickets, Monday through Sunday.",
  "chart": {
    "kind": "bar",
    "labels": ["Mon", "Tue", "Wed"],
    "series": [{ "name": "Tickets", "values": [58, 41, 36] }]
  }
}
```
- `kind: "bar"` — bars grow, values land on top; the last bar is highlighted amber.
- `kind: "line"` — the line draws on, dots pop, area fades in.
- `kind: "donut"` — share-style ring (values should sum to ~100); the largest segment takes the center.

### `timeline` — the week, day by day
```json
{
  "type": "timeline",
  "heading": "The week, day by day",
  "events": [
    { "day": "Mon", "date": "Oct 5", "text": "What happened.", "tag": "incident" }
  ]
}
```
`tag` colors the dot: `release` (blurple), `milestone` (amber), `win` (green), `incident` (red), or omit for default.

### `winsBlockers` — the honest part
```json
{
  "type": "winsBlockers",
  "wins": [{ "text": "Coverage crossed 80%", "note": "From 71% last week." }],
  "blockers": [{ "text": "Export slipped", "note": "Who owns it, when it clears." }]
}
```

### `outlook` — next week's commitments
```json
{
  "type": "outlook",
  "heading": "Next week's plan",
  "items": [{ "text": "Audit export schema in", "due": "Thu" }],
  "note": "The one-line stakes."
}
```

### `outro` — the button
```json
{
  "type": "outro",
  "message": "A quotable last line.",
  "highlights": ["+18% tasks automated", "0 incidents"]
}
```

## The commands

```bash
node build/new-week.js 2026-W41          # scaffold from template
node build/generate.js 2026-W41          # validate + generate TTS + manifest
node build/generate.js 2026-W41 --skip-tts   # validate only
npm run serve                            # preview at http://localhost:8080/?week=2026-W41
```

The validator gives friendly errors (`sections[2] (chart): chart.kind must be one of bar, line, donut`) and refuses to build on errors. Warnings (missing narration, donut not summing to 100) don't block.

## Adding a new section type

1. Create `player/sections/myType.js` exporting `render(section, ctx)` that returns a `.scene` root element (start from `shell.js`'s `sceneShell`/`headingBlock`).
2. Mark animated children with `data-animate` and stagger them via `revealStaggered` (handled by the engine).
3. Register it in `player/sections/index.js`.
4. Add the type to `SECTION_TYPES` in `build/lib/validate.js`.

## Narration audio details

- Generated MP3s land in `audio/<week>/sceneNN.mp3` + `manifest.json` (index → file, duration, text).
- The player fetches `audio/<week>/manifest.json`; on 404 it switches to SpeechSynthesis. Scene pacing then uses a word-count estimate.
- TTS runs through the J.A.R.V.I.S venv (`en-GB-RyanNeural`). Override with `JARVIS_PY` / `TTS_VOICE` env vars.
