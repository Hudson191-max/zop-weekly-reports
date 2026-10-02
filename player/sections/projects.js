// Projects build board: status pills + animated progress bars.
import { el } from "../format.js";
import { sceneShell, headingBlock } from "./shell.js";

const STATUS_CLASS = {
  shipped: "shipped",
  "in-progress": "in-progress",
  "at-risk": "at-risk",
  planned: "planned",
};

export function renderProjects(section, ctx) {
  const { root, inner } = sceneShell(section, ctx);
  inner.append(headingBlock(section, "The build board"));

  const list = el("div", { class: "project-list" });
  inner.append(list);

  section.items?.forEach((item) => {
    const progress = Math.max(0, Math.min(100, item.progress ?? 0));
    const statusKey = STATUS_CLASS[item.status] || "planned";
    const bar = el("div", { class: "progress-bar", style: { "--p": `${progress}%` } });
    if (item.status === "at-risk") bar.classList.add("risky");
    if (item.status === "shipped") bar.classList.add("done");

    list.append(
      el("div", { class: "project-card", "data-animate": "" },
        el("div", { class: "project-name" }, item.name || ""),
        el("div", { class: "progress-track" }, bar),
        el("span", { class: `status-pill status-${statusKey}` }, (item.status || "planned").replace("-", " ")),
        item.note ? el("p", { class: "project-note" }, item.note) : null,
      ),
    );
  });

  return root;
}
