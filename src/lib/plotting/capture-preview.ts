/** Снимок превью чертежа — как на экране (шрифты, KaTeX, масштаб контейнера). */
import { toPng } from "html-to-image";

function parseBackground(el: HTMLElement): string {
  const bg = getComputedStyle(el).backgroundColor;
  return bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)" ? bg : "#ffffff";
}

/** PNG data URL превью для отправки в image-модель. */
export async function capturePlotPreviewPng(container: HTMLElement): Promise<string> {
  const backgroundColor = parseBackground(container);
  return toPng(container, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor,
    style: {
      transform: "none",
      margin: "0",
      boxShadow: "none",
    },
  });
}
