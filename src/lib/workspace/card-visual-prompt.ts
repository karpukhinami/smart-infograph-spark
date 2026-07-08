import { DEFAULT_A4_SETTINGS } from "@/lib/a4-layout/settings";

/**
 * Target max longest side when the visual is embedded in a card (logical layout px, ≈⅓ card column).
 * For future API size limits — not stated in the prompt to avoid oversized generations.
 */
export const CARD_VISUAL_MAX_LONG_SIDE_LAYOUT_PX = Math.round(DEFAULT_A4_SETTINGS.pageWidthPx / 3);

export function buildCardVisualImagePrompt(description: string): string {
  const desc = description.trim();
  return `Create ONE small educational illustration for a card inset in a school infographic. This is NOT a full-page poster, NOT a banner, NOT a slide — only a compact card-sized picture.

Subject / scene:
${desc}

Size and framing:
- Small, compact illustration that will sit inside a single card on an infographic
- Do NOT generate a large canvas or poster; keep the scene tight and modest in scale
- The artwork MUST fill the entire image area edge to edge — no empty margins, no padding, no letterboxing, no wide blank borders, no unused space around the subject
- Crop tight: every pixel of the image should belong to the drawing; nothing should float in a large empty field

TRANSPARENT BACKGROUND (mandatory — do not ignore):
- The background MUST be fully transparent (alpha channel)
- NO solid fill behind the subject: no white, beige, grey, gradient plate, vignette frame, or “card” backdrop
- NO checkerboard or fake transparency preview — output real transparency suitable for PNG
- Only the drawn subject (lines, shapes, fills that are part of the illustration) may be opaque; everything else is transparent

Style and content:
- Clear, simple, pedagogical line-art or flat illustration style
- No text labels, captions, watermarks, or decorative borders unless explicitly described in the subject above
- No drop shadow on a fake floor or separate background layer`;
}

export async function generateCardVisualImage(description: string, model: string): Promise<string> {
  const { callImageLLM } = await import("@/lib/llm-client");
  const prompt = buildCardVisualImagePrompt(description);
  return callImageLLM({ model, prompt });
}
