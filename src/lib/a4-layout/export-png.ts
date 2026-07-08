import { toPng } from "html-to-image";
import { computeCanvas } from "@/lib/render-spec/tokens";

const portrait = computeCanvas("portrait");

/** Target export size — same as programmatic renderer / generated images (portrait). */
export const A4_LAYOUT_EXPORT_WIDTH = portrait.width;
export const A4_LAYOUT_EXPORT_HEIGHT = portrait.height;

async function waitForFormulaTypeset(root: HTMLElement, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let pending = false;
    root.querySelectorAll<HTMLElement>(".a4-formula p, .a4-side-formula").forEach((node) => {
      if (node.textContent?.trim() && !node.querySelector(".katex")) pending = true;
    });
    if (!pending) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Rasterize the layout frame at export resolution (logical layout stays 595×842). */
export async function exportA4LayoutPng(frame: HTMLElement): Promise<string> {
  await waitForFormulaTypeset(frame);
  frame.querySelectorAll(".a4-fit-badge").forEach((b) => b.remove());

  const bg = getComputedStyle(frame).backgroundColor;
  return toPng(frame, {
    width: A4_LAYOUT_EXPORT_WIDTH,
    height: A4_LAYOUT_EXPORT_HEIGHT,
    cacheBust: true,
    pixelRatio: 1,
    backgroundColor: bg && bg !== "transparent" ? bg : "#f7f8fc",
  });
}
