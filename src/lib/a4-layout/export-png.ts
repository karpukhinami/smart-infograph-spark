import { toPng } from "html-to-image";
import { computeCanvas } from "@/lib/render-spec/tokens";
import { DEFAULT_A4_SETTINGS } from "@/lib/a4-layout/settings";

const portrait = computeCanvas("portrait");

/** Target export size — same as programmatic renderer / generated images (portrait). */
export const A4_LAYOUT_EXPORT_WIDTH = portrait.width;
export const A4_LAYOUT_EXPORT_HEIGHT = portrait.height;

/** Uniform scale from logical layout px to export width (fonts scale with this). */
export function a4LayoutExportPixelRatio(
  logicalWidth = DEFAULT_A4_SETTINGS.pageWidthPx,
): number {
  return A4_LAYOUT_EXPORT_WIDTH / logicalWidth;
}

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

function parseRgbBackground(el: HTMLElement): string {
  const bg = getComputedStyle(el).backgroundColor;
  return bg && bg !== "transparent" ? bg : "#f7f8fc";
}

/** Crop / pad raster to exact export canvas (top-aligned; slight bottom crop if aspect differs). */
function fitRasterToExportCanvas(dataUrl: string, backgroundColor: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = A4_LAYOUT_EXPORT_WIDTH;
      canvas.height = A4_LAYOUT_EXPORT_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D unavailable"));
        return;
      }
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = A4_LAYOUT_EXPORT_WIDTH / img.width;
      const drawW = A4_LAYOUT_EXPORT_WIDTH;
      const drawH = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, drawW, drawH);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Не удалось прочитать снимок макета"));
    img.src = dataUrl;
  });
}

/**
 * Rasterize the layout frame at export resolution.
 * Uses pixelRatio (not oversized empty canvas) so content fills the page with proportional typography.
 */
export async function exportA4LayoutPng(frame: HTMLElement): Promise<string> {
  await waitForFormulaTypeset(frame);
  frame.querySelectorAll(".a4-fit-badge").forEach((b) => b.remove());

  const backgroundColor = parseRgbBackground(frame);
  const logicalWidth = frame.offsetWidth || DEFAULT_A4_SETTINGS.pageWidthPx;
  const pixelRatio = a4LayoutExportPixelRatio(logicalWidth);

  const raw = await toPng(frame, {
    pixelRatio,
    cacheBust: true,
    backgroundColor,
    style: {
      // Ensure capture ignores on-screen preview zoom on ancestors.
      transform: "none",
      margin: "0",
      boxShadow: "none",
    },
  });

  return fitRasterToExportCanvas(raw, backgroundColor);
}
