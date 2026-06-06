import { createFileRoute } from "@tanstack/react-router";
import { OPENROUTER_API_KEY } from "@/lib/openrouter";

interface ReqBody {
  model: string;
  prompt: string;
  system?: string;
}

export const Route = createFileRoute("/api/llm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ReqBody;
        if (!body?.model || !body?.prompt) {
          return new Response("Missing model or prompt", { status: 400 });
        }

        // Heuristic: Lovable Gateway accepts any model id in our catalog except those tagged as openrouter.
        // We forward to OpenRouter when the openrouter key is set AND the id is not a known Lovable id pattern.
        // Simpler: try OpenRouter if model contains "/" AND OPENROUTER_API_KEY is set AND model is not in the Lovable preset list.
        const lovablePresets = new Set([
          "google/gemini-3-flash-preview",
          "google/gemini-2.5-pro",
          "google/gemini-2.5-flash",
          "openai/gpt-5",
          "openai/gpt-5-mini",
          "openai/gpt-5-nano",
        ]);

        const useOpenRouter = !lovablePresets.has(body.model);
        const messages = [
          ...(body.system ? [{ role: "system", content: body.system }] : []),
          { role: "user", content: body.prompt },
        ];

        let upstreamUrl: string;
        let headers: Record<string, string>;

        if (useOpenRouter) {
          if (!OPENROUTER_API_KEY) {
            return new Response(
              "OpenRouter API key not configured. Paste it into src/lib/openrouter.ts.",
              { status: 500 },
            );
          }
          upstreamUrl = "https://openrouter.ai/api/v1/chat/completions";
          headers = {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          };
        } else {
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("LOVABLE_API_KEY not configured", { status: 500 });
          upstreamUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
          headers = {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          };
        }

        const upstream = await fetch(upstreamUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ model: body.model, messages }),
        });

        if (!upstream.ok) {
          const errText = await upstream.text().catch(() => "");
          return new Response(`Upstream error: ${errText || upstream.statusText}`, {
            status: upstream.status,
          });
        }

        const data = (await upstream.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content ?? "";
        return Response.json({ text });
      },
    },
  },
});
