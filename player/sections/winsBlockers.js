// Wins & blockers: two-column scorecard.
import { el } from "../format.js";
import { sceneShell, headingBlock } from "./shell.js";

function column(kind, title, items) {
  const col = el("div", { class: `wb-col ${kind}`, "data-animate": "" },
    el("p", { class: "wb-col-title" }, title),
  );
  items?.forEach((item) => {
    col.append(
      el("div", { class: "wb-item" },
        el("p", { class: "wb-text" }, item.text || ""),
        item.note ? el("p", { class: "wb-note" }, item.note) : null,
      ),
    );
  });
  return col;
}

export function renderWinsBlockers(section, ctx) {
  const { root, inner } = sceneShell(section, ctx);
  inner.append(headingBlock(section, "The honest part"));

  inner.append(
    el("div", { class: "wb-grid" },
      column("wins", "Wins", section.wins),
      column("blockers", "Blockers", section.blockers),
    ),
  );
  return root;
}
