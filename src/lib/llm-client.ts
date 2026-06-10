// Client-side helpers calling the server routes.
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
  const data = (await res.json()) as { text: string };
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
  const data = (await res.json()) as { b64: string };
  return `data:image/png;base64,${data.b64}`;
}
