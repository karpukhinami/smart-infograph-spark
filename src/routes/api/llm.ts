import { createFileRoute } from "@tanstack/react-router";
import { OPENROUTER_API_KEY } from "@/lib/openrouter";

interface ReqBody {
  model: string;
  prompt: string;
  system?: string;
  images?: string[];
}

export const Route = createFileRoute("/api/llm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ReqBody;
        if (!body?.model || !body?.prompt) {
          return new Response("Missing model or prompt", { status: 400 });
        }

        const lovablePresets = new Set([
          "google/gemini-3-flash-preview",
          "google/gemini-2.5-pro",
          "google/gemini-2.5-flash",
          "openai/gpt-5",
          "openai/gpt-5-mini",
          "openai/gpt-5-nano",
        ]);

        const useOpenRouter = !lovablePresets.has(body.model);

        const userContent: unknown = body.images?.length
          ? [
              { type: "text", text: body.prompt },
              ...body.images.map((url) => ({ type: "image_url", image_url: { url } })),
            ]
          : body.prompt;

        const messages = [
          ...(body.system ? [{ role: "system", content: body.system }] : []),
          { role: "user", content: userContent },
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
