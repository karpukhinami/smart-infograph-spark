import { createFileRoute } from "@tanstack/react-router";

interface ReqBody {
  model: string;
  prompt: string;
}

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ReqBody;
        if (!body?.model || !body?.prompt) {
          return new Response("Missing model or prompt", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY not configured", { status: 500 });

        // Build per-model body
        const isGemini = body.model.startsWith("google/");
        const upstreamBody = isGemini
          ? {
              model: body.model,
              messages: [{ role: "user", content: body.prompt }],
              modalities: ["image", "text"],
            }
          : {
              model: body.model,
              prompt: body.prompt,
              quality: "low",
              size: "1024x1024",
              n: 1,
            };

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(upstreamBody),
        });
        if (!upstream.ok) {
          const errText = await upstream.text().catch(() => "");
          return new Response(`Upstream error: ${errText || upstream.statusText}`, {
            status: upstream.status,
          });
        }
        const data = (await upstream.json()) as {
          data?: Array<{ b64_json?: string }>;
          usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
        };
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) return new Response("No image returned", { status: 502 });
        return Response.json({ b64, usage: data.usage ?? null, model: body.model });
      },
    },
  },
});
