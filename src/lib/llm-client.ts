// Client-side helpers calling the server routes.
import { useUsageStore } from "@/store/useUsageStore";
import { computeCost } from "@/lib/pricing";

interface UsagePayload {
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

function recordUsage(
  model: string,
  usage: UsagePayload | null | undefined,
  kind: "text" | "image",
) {
  if (!usage) return;
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;
  const costUsd = computeCost(model, inputTokens, outputTokens, kind);
  useUsageStore
    .getState()
    .add({ model, inputTokens, outputTokens, totalTokens, costUsd, kind, at: Date.now() });
}

export async function callTextLLM(opts: {
  model: string;
  prompt: string;
  system?: string;
  images?: string[]; // data URLs or https URLs
}): Promise<string> {
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${text || res.statusText}`);
  }
  const data = (await res.json()) as {
    text: string;
    usage?: UsagePayload | null;
    model?: string;
  };
  recordUsage(data.model ?? opts.model, data.usage, "text");
  return data.text;
}

export async function callImageLLM(opts: { model: string; prompt: string }): Promise<string> {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Image generation failed (${res.status}): ${text || res.statusText}`);
  }
  const data = (await res.json()) as {
    b64: string;
    usage?: UsagePayload | null;
    model?: string;
  };
  recordUsage(data.model ?? opts.model, data.usage, "image");
  return `data:image/png;base64,${data.b64}`;
}
