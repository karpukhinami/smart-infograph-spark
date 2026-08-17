/**
 * Off-screen renderer for the stat-deco reference chart.
 *
 * The chart PNG must be attachable to the design-brief model and to the drawing
 * model regardless of whether the user ever opened the «авто-макет» tab, so the
 * chart is rendered into a detached container on demand.
 */
import type { DesignProfile, StatDecoJson } from "@/lib/types";
import { buildStatDecoOption } from "./echarts-option";
import { getStatDecoChartPng, setStatDecoChartPng } from "./chart-image";

interface EchartsLike {
  setOption: (option: unknown, notMerge: boolean) => void;
  dispose: () => void;
  getDataURL: (opts: { type: string; pixelRatio: number; backgroundColor?: string }) => string;
}

/**
 * Renders the chart off-screen and returns a `data:image/png;base64,…` URL.
 * Falls back to the last chart rendered in the preview when off-screen
 * rendering is not possible (SSR, invalid data).
 */
export async function renderStatDecoChartPng(
  statDeco: StatDecoJson,
  profile: DesignProfile | null,
): Promise<string | null> {
  if (typeof document === "undefined") return getStatDecoChartPng();
  const { option, error } = buildStatDecoOption(statDeco, profile);
  if (error) return getStatDecoChartPng();

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "1200px";
  host.style.height = "800px";
  document.body.appendChild(host);

  let chart: EchartsLike | null = null;
  try {
    const echarts = await import("echarts");
    chart = echarts.init(host, undefined, {
      renderer: "canvas",
      devicePixelRatio: 2,
    }) as unknown as EchartsLike;
    chart.setOption(option, true);
    const dataUrl = chart.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: option.backgroundColor as string | undefined,
    });
    setStatDecoChartPng(dataUrl);
    return dataUrl;
  } catch {
    return getStatDecoChartPng();
  } finally {
    chart?.dispose();
    host.remove();
  }
}
