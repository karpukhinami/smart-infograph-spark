import cardVisualImagePromptTemplate from "@/data/prompts/workspace/card-visual-image.txt?raw";
import { DEFAULT_A4_SETTINGS } from "@/lib/a4-layout/settings";

/**
 * Target max longest side when the visual is embedded in a card (logical layout px, ≈⅓ card column).
 * For future API size limits — not stated in the prompt to avoid oversized generations.
 */
export const CARD_VISUAL_MAX_LONG_SIDE_LAYOUT_PX = Math.round(DEFAULT_A4_SETTINGS.pageWidthPx / 3);

/** Default card-visual image prompt (edit the .txt file in data/prompts/workspace/). */
export const CARD_VISUAL_IMAGE_PROMPT_TEMPLATE = cardVisualImagePromptTemplate;

/** OpenRouter image API params for card visuals (fixed for now). */
export const CARD_VISUAL_OPENROUTER_RESOLUTION = "512";
export const CARD_VISUAL_OPENROUTER_ASPECT_RATIO = "1:1";

export function buildCardVisualImagePrompt(description: string): string {
  return CARD_VISUAL_IMAGE_PROMPT_TEMPLATE.replace("{{DESCRIPTION}}", description.trim());
}

export async function generateCardVisualImage(description: string, model: string): Promise<string> {
  const { callImageLLM } = await import("@/lib/llm-client");
  const prompt = buildCardVisualImagePrompt(description);
  const resolution = CARD_VISUAL_OPENROUTER_RESOLUTION;
  const aspect_ratio = CARD_VISUAL_OPENROUTER_ASPECT_RATIO;

  console.log("[card visual image request]", { model, prompt, resolution, aspect_ratio });

  return callImageLLM({ model, prompt, resolution, aspect_ratio });
}
