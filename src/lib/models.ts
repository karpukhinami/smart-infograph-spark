import openrouterModels from "@/data/openrouter-models.json";

export type ModelKind = "text" | "image";
export interface ModelOption {
  /** UI value — unique across all models. OpenRouter entries are prefixed
   *  with `openrouter:` to disambiguate from Lovable-gateway entries that
   *  happen to share the same upstream id (e.g. google/gemini-*-image). */
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

const OR_PREFIX = "openrouter:";

function shortLabel(id: string): string {
  const tail = id.split("/").pop() ?? id;
  return `OpenRouter: ${tail}`;
}

export const TEXT_MODELS: ModelOption[] = [
  ...or.text.map((m) => ({
    id: OR_PREFIX + m.id,
    label: shortLabel(m.id),
    provider: "openrouter" as const,
    kind: "text" as const,
  })),
  { id: "google/gemini-3-flash-preview", label: "Lovable: Gemini 3 Flash", provider: "lovable", kind: "text" },
  { id: "google/gemini-2.5-pro", label: "Lovable: Gemini 2.5 Pro", provider: "lovable", kind: "text" },
  { id: "openai/gpt-5", label: "Lovable: GPT-5", provider: "lovable", kind: "text" },
  { id: "openai/gpt-5-mini", label: "Lovable: GPT-5 mini", provider: "lovable", kind: "text" },
];

export const IMAGE_MODELS: ModelOption[] = [
  ...or.image.map((m) => ({
    id: OR_PREFIX + m.id,
    label: shortLabel(m.id),
    provider: "openrouter" as const,
    kind: "image" as const,
  })),
  { id: "google/gemini-3.1-flash-image-preview", label: "Lovable: Nano Banana 2", provider: "lovable", kind: "image" },
  { id: "google/gemini-2.5-flash-image", label: "Lovable: Nano Banana", provider: "lovable", kind: "image" },
  { id: "openai/gpt-image-2", label: "Lovable: GPT-image-2", provider: "lovable", kind: "image" },
  { id: "google/gemini-3-pro-image-preview", label: "Lovable: Gemini 3 Pro Image", provider: "lovable", kind: "image" },
];

/** Default text model — OpenRouter Gemini 2.5 Flash. */
export const DEFAULT_TEXT_MODEL = OR_PREFIX + "google/gemini-2.5-flash";
/** Default image model — OpenRouter auto (free routing). */
export const DEFAULT_IMAGE_MODEL = OR_PREFIX + "openrouter/auto";

/** True when the UI value resolves to OpenRouter. */
export function isOpenRouterModel(id: string): boolean {
  return id.startsWith(OR_PREFIX);
}

/** Strip the UI provider prefix to get the real upstream model id. */
export function resolveUpstreamModelId(id: string): string {
  return id.startsWith(OR_PREFIX) ? id.slice(OR_PREFIX.length) : id;
}
