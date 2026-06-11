// Approximate USD prices per 1M tokens. Update as needed.
// Source: Lovable AI Gateway / OpenRouter public pricing snapshots.
export interface ModelPrice {
  inputPerM: number; // USD per 1M input tokens
  outputPerM: number; // USD per 1M output tokens
  imagePerM?: number; // USD per 1M output image tokens (image models)
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Text
  "google/gemini-3-flash-preview": { inputPerM: 0.3, outputPerM: 2.5 },
  "google/gemini-2.5-pro": { inputPerM: 1.25, outputPerM: 10 },
  "google/gemini-2.5-flash": { inputPerM: 0.3, outputPerM: 2.5 },
  "openai/gpt-5": { inputPerM: 1.25, outputPerM: 10 },
  "openai/gpt-5-mini": { inputPerM: 0.25, outputPerM: 2 },
  "openai/gpt-5-nano": { inputPerM: 0.05, outputPerM: 0.4 },
  "openai/gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
  "anthropic/claude-3.5-sonnet": { inputPerM: 3, outputPerM: 15 },
  // Image
  "openai/gpt-image-2": { inputPerM: 5, outputPerM: 40, imagePerM: 40 },
  "openai/gpt-image-1-mini": { inputPerM: 2, outputPerM: 8, imagePerM: 8 },
  "google/gemini-2.5-flash-image": { inputPerM: 0.3, outputPerM: 30, imagePerM: 30 },
  "google/gemini-3.1-flash-image-preview": { inputPerM: 0.3, outputPerM: 30, imagePerM: 30 },
  "google/gemini-3-pro-image-preview": { inputPerM: 2, outputPerM: 60, imagePerM: 60 },
};

export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  kind: "text" | "image";
  at: number;
}

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  kind: "text" | "image",
): number {
  const p = MODEL_PRICES[model];
  if (!p) return 0;
  const out = kind === "image" && p.imagePerM != null ? p.imagePerM : p.outputPerM;
  return (inputTokens * p.inputPerM + outputTokens * out) / 1_000_000;
}

export function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(5)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
