import openrouterModels from "@/data/openrouter-models.json";

export type ModelKind = "text" | "image";
export interface ModelOption {
  id: string;
  label: string;
  provider: "lovable" | "openrouter";
  kind: ModelKind;
}

export const TEXT_MODELS: ModelOption[] = [
  { id: "google/gemini-3-flash-preview", label: "Lovable: Gemini 3 Flash (default)", provider: "lovable", kind: "text" },
  { id: "google/gemini-2.5-pro", label: "Lovable: Gemini 2.5 Pro", provider: "lovable", kind: "text" },
  { id: "openai/gpt-5", label: "Lovable: GPT-5", provider: "lovable", kind: "text" },
  { id: "openai/gpt-5-mini", label: "Lovable: GPT-5 mini", provider: "lovable", kind: "text" },
  ...(openrouterModels as Array<{ id: string; label: string }>).map((m) => ({
    id: m.id,
    label: m.label,
    provider: "openrouter" as const,
    kind: "text" as const,
  })),
];

export const IMAGE_MODELS: ModelOption[] = [
  { id: "google/gemini-3.1-flash-image-preview", label: "Lovable: Nano Banana 2 (default)", provider: "lovable", kind: "image" },
  { id: "google/gemini-2.5-flash-image", label: "Lovable: Nano Banana", provider: "lovable", kind: "image" },
  { id: "openai/gpt-image-2", label: "Lovable: GPT-image-2", provider: "lovable", kind: "image" },
  { id: "google/gemini-3-pro-image-preview", label: "Lovable: Gemini 3 Pro Image", provider: "lovable", kind: "image" },
];

export const DEFAULT_TEXT_MODEL = TEXT_MODELS[0].id;
export const DEFAULT_IMAGE_MODEL = IMAGE_MODELS[0].id;
