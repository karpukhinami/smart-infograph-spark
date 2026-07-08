import { A4_LAYOUT_EXPORT_WIDTH } from "@/lib/a4-layout/export-png";
import { DEFAULT_A4_SETTINGS } from "@/lib/a4-layout/settings";

/** Max longest side when the visual is placed in the layout (logical px, ≈⅓ A4 width). */
export const CARD_VISUAL_MAX_LONG_SIDE_LAYOUT_PX = Math.round(DEFAULT_A4_SETTINGS.pageWidthPx / 3);

/** Max longest side for the generated raster (export resolution, ≈⅓ export width). */
export const CARD_VISUAL_MAX_LONG_SIDE_EXPORT_PX = Math.round(A4_LAYOUT_EXPORT_WIDTH / 3);

export function buildCardVisualImagePrompt(description: string): string {
  const desc = description.trim();
  return `Create a single educational illustration for a school infographic card.

Subject / scene:
${desc}

Requirements:
- Clear, simple, pedagogical style suitable for a textbook infographic
- No text labels, captions, watermarks, or decorative borders unless explicitly described above
- The image will be embedded inside a card; keep the composition compact — the longest side should fit within roughly ${CARD_VISUAL_MAX_LONG_SIDE_EXPORT_PX}px when scaled into a ${A4_LAYOUT_EXPORT_WIDTH}px-wide portrait page (about one third of a card column)
- Use a plain or softly neutral background that works on a pastel card surface`;
}

export async function generateCardVisualImage(description: string, model: string): Promise<string> {
  const { callImageLLM } = await import("@/lib/llm-client");
  const prompt = buildCardVisualImagePrompt(description);
  return callImageLLM({ model, prompt });
}
