/**
 * Holder for the last programmatically rendered stat-deco chart image.
 *
 * The reference chart is later sent to the drawing model together with the
 * design brief, so it is kept in the exact shape OpenRouter / the AI gateway
 * accepts: a `data:image/png;base64,...` URL (the same shape used for attached
 * source images elsewhere in the app).
 */
let lastChartPngDataUrl: string | null = null;

export function setStatDecoChartPng(dataUrl: string | null): void {
  lastChartPngDataUrl = dataUrl;
}

/** Data URL (`data:image/png;base64,…`) ready to be attached to an LLM call. */
export function getStatDecoChartPng(): string | null {
  return lastChartPngDataUrl;
}

/** Bare base64 payload, for APIs that expect raw base64 without the prefix. */
export function getStatDecoChartBase64(): string | null {
  if (!lastChartPngDataUrl) return null;
  const idx = lastChartPngDataUrl.indexOf(",");
  return idx >= 0 ? lastChartPngDataUrl.slice(idx + 1) : null;
}
