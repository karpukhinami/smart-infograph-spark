import { createFileRoute } from "@tanstack/react-router";
import { OPENROUTER_API_KEY } from "@/lib/openrouter";

interface ReqBody {
  model: string;
  prompt: string;
}

const LOVABLE_IMAGE_MODELS = new Set([
  "openai/gpt-image-2",
  "openai/gpt-image-1-mini",
  "google/gemini-2.5-flash-image",
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
]);

const OPENROUTER_TIMEOUT_MS = 120_000;

function isContextTooLongError(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("context length") ||
    t.includes("too long") ||
    t.includes("token limit") ||
    t.includes("maximum context")
  );
}

function extractB64FromDataUrl(url: string): string {
  const i = url.indexOf("base64,");
  return i >= 0 ? url.slice(i + 7) : url;
}

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ReqBody;
        if (!body?.model || !body?.prompt) {
          return new Response("Missing model or prompt", { status: 400 });
        }

        const useOpenRouter = !LOVABLE_IMAGE_MODELS.has(body.model);

        if (useOpenRouter) {
          if (!OPENROUTER_API_KEY) {
            return new Response(
              "OpenRouter API key not configured. Paste it into src/lib/openrouter.ts.",
              { status: 500 },
            );
          }
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
          let upstream: Response;
          try {
            upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: body.model,
                messages: [{ role: "user", content: body.prompt }],
                modalities: ["image", "text"],
              }),
              signal: controller.signal,
            });
          } catch (e) {
            clearTimeout(timer);
            if ((e as Error)?.name === "AbortError") {
              return new Response(
                `OpenRouter timeout: модель «${body.model}» не вернула изображение за ${Math.round(
                  OPENROUTER_TIMEOUT_MS / 1000,
                )} сек. Попробуйте другую модель или упростите промпт.`,
                { status: 504 },
              );
            }
            return new Response(`Network error: ${(e as Error).message}`, { status: 502 });
          }
          clearTimeout(timer);

          if (!upstream.ok) {
            const errText = await upstream.text().catch(() => "");
            if (isContextTooLongError(errText) || upstream.status === 413) {
              return new Response(
                `Запрос слишком длинный для модели «${body.model}». Сократите промпт. (${errText.slice(0, 200)})`,
                { status: 413 },
              );
            }
            return new Response(`Upstream error: ${errText || upstream.statusText}`, {
              status: upstream.status,
            });
          }
          const data = (await upstream.json()) as {
            choices?: Array<{
              message?: {
                content?: string;
                images?: Array<{ image_url?: { url?: string } | string; type?: string }>;
              };
            }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            error?: { message?: string };
          };
          if (data.error?.message) {
            return new Response(`Upstream error: ${data.error.message}`, { status: 502 });
          }
          const imgs = data.choices?.[0]?.message?.images;
          const first = imgs?.[0];
          const url =
            typeof first?.image_url === "string"
              ? first.image_url
              : first?.image_url?.url ?? "";
          if (!url) return new Response("No image returned by OpenRouter", { status: 502 });
          return Response.json({
            b64: extractB64FromDataUrl(url),
            usage: data.usage ?? null,
            model: body.model,
          });
        }

        // Lovable path
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY not configured", { status: 500 });

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
