import beautifyRules from "@/data/prompts/plotting/beautify-image.txt?raw";
import { callImageLLM } from "@/lib/llm-client";
import { DEFAULT_IMAGE_MODEL } from "@/lib/models";
import { capturePlotPreviewPng } from "./capture-preview";

export function buildPlotBeautifyPrompt(userWishes: string): string {
  const wishes = userWishes.trim();
  return `${wishes}\n\n${beautifyRules.trim()}`;
}

export async function generatePlotBeautifiedImage(opts: {
  previewEl: HTMLElement;
  userWishes: string;
}): Promise<string> {
  const png = await capturePlotPreviewPng(opts.previewEl);
  return callImageLLM({
    model: DEFAULT_IMAGE_MODEL,
    prompt: buildPlotBeautifyPrompt(opts.userWishes),
    images: [png],
  });
}
