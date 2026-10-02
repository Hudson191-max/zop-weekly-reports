// Outlook: next week's commitments.
import { el } from "../format.js";
import { sceneShell, headingBlock } from "./shell.js";

export function renderOutlook(section, ctx) {
  const { root, inner } = sceneShell(section, ctx);
  inner.append(headingBlock(section, "Looking ahead"));

  const list = el("div", { class: "outlook-list" });
  section.items?.forEach((item) => {
    list.append(
      el("div", { class: "outlook-item", "data-animate": "" },
        item.due ? el("span", { class: "due" }, item.due) : null,
        el("span", { class: "txt" }, item.text || ""),
      ),
    );
  });
  inner.append(list);

  if (section.note) {
    inner.append(el("p", { class: "outlook-note", "data-animate": "" }, section.note));
  }
  return root;
}
