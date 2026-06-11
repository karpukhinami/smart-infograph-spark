import openrouterModels from "@/data/openrouter-models.json";

export type ModelKind = "text" | "image";
export interface ModelOption {
  id: string;
  label: string;
  provider: "lovable" | "openrouter";
  kind: ModelKind;
}

interface OrEntry {
  id: string;
  inputPerM: number;
  outputPerM: number;
}
const or = openrouterModels as { text: OrEntry[]; image: OrEntry[] };

function shortLabel(id: string): string {
  const tail = id.split("/").pop() ?? id;
  return `OpenRouter: ${tail}`;
}

export const TEXT_MODELS: ModelOption[] = [
  { id: "google/gemini-3-flash-preview", label: "Lovable: Gemini 3 Flash (default)", provider: "lovable", kind: "text" },
  { id: "google/gemini-2.5-pro", label: "Lovable: Gemini 2.5 Pro", provider: "lovable", kind: "text" },
  { id: "openai/gpt-5", label: "Lovable: GPT-5", provider: "lovable", kind: "text" },
  { id: "openai/gpt-5-mini", label: "Lovable: GPT-5 mini", provider: "lovable", kind: "text" },
  ...or.text.map((m) => ({
    id: m.id,
    label: shortLabel(m.id),
    provider: "openrouter" as const,
    kind: "text" as const,
  })),
];

export const IMAGE_MODELS: ModelOption[] = [
  { id: "google/gemini-3.1-flash-image-preview", label: "Lovable: Nano Banana 2 (default)", provider: "lovable", kind: "image" },
  { id: "google/gemini-2.5-flash-image", label: "Lovable: Nano Banana", provider: "lovable", kind: "image" },
  { id: "openai/gpt-image-2", label: "Lovable: GPT-image-2", provider: "lovable", kind: "image" },
  { id: "google/gemini-3-pro-image-preview", label: "Lovable: Gemini 3 Pro Image", provider: "lovable", kind: "image" },
  ...or.image.map((m) => ({
    id: m.id,
    label: shortLabel(m.id),
    provider: "openrouter" as const,
    kind: "image" as const,
  })),
];

export const DEFAULT_TEXT_MODEL = TEXT_MODELS[0].id;
export const DEFAULT_IMAGE_MODEL = IMAGE_MODELS[0].id;

/** Returns true when the given model id is served via OpenRouter. */
export function isOpenRouterModel(id: string): boolean {
  return [...or.text, ...or.image].some((m) => m.id === id);
}
