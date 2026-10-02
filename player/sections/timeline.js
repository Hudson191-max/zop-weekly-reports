// Timeline scene: the week, day by day.
import { el } from "../format.js";
import { sceneShell, headingBlock } from "./shell.js";

export function renderTimeline(section, ctx) {
  const { root, inner } = sceneShell(section, ctx);
  inner.append(headingBlock(section, "Chronology"));

  const tl = el("div", { class: "timeline" });
  inner.append(tl);

  section.events?.forEach((ev) => {
    const cls = ev.tag ? ` tag-${ev.tag}` : "";
    tl.append(
      el("div", { class: `tl-event${cls}`, "data-animate": "" },
        el("div", { class: "tl-head" },
          el("span", { class: "tl-day" }, [ev.day, ev.date].filter(Boolean).join(" · ")),
        ),
        el("p", { class: "tl-text" }, ev.text || ""),
      ),
    );
  });

  return root;
}
