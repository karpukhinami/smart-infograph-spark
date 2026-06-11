import { createFileRoute } from "@tanstack/react-router";
import { OPENROUTER_API_KEY } from "@/lib/openrouter";

interface ReqBody {
  model: string;
  prompt: string;
  system?: string;
  images?: string[];
}

const LOVABLE_PRESETS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
]);

const OPENROUTER_TIMEOUT_MS = 90_000;

function isContextTooLongError(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("context length") ||
    t.includes("context_length") ||
    t.includes("maximum context") ||
    t.includes("too long") ||
    t.includes("token limit") ||
    t.includes("max tokens") ||
    t.includes("prompt is too long")
  );
}

export const Route = createFileRoute("/api/llm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ReqBody;
        if (!body?.model || !body?.prompt) {
          return new Response("Missing model or prompt", { status: 400 });
        }

        const useOpenRouter = !LOVABLE_PRESETS.has(body.model);

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

        const controller = new AbortController();
        const timer = useOpenRouter
          ? setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS)
          : null;

        let upstream: Response;
        try {
          upstream = await fetch(upstreamUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ model: body.model, messages }),
            signal: controller.signal,
          });
        } catch (e) {
          if (timer) clearTimeout(timer);
          const aborted = (e as Error)?.name === "AbortError";
          if (aborted) {
            return new Response(
              `OpenRouter timeout: модель «${body.model}» не ответила за ${Math.round(
                OPENROUTER_TIMEOUT_MS / 1000,
              )} сек. Попробуйте другую модель или сократите запрос.`,
              { status: 504 },
            );
          }
          return new Response(`Network error: ${(e as Error).message}`, { status: 502 });
        }
        if (timer) clearTimeout(timer);

        if (!upstream.ok) {
          const errText = await upstream.text().catch(() => "");
          if (isContextTooLongError(errText) || upstream.status === 413) {
            return new Response(
              `Запрос слишком длинный для модели «${body.model}». Сократите исходный текст или выберите модель с большим контекстом. (${errText.slice(0, 200)})`,
              { status: 413 },
            );
          }
          return new Response(`Upstream error: ${errText || upstream.statusText}`, {
            status: upstream.status,
          });
        }

        const data = (await upstream.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
          error?: { message?: string; code?: number | string };
        };
        if (data.error?.message) {
          const msg = data.error.message;
          if (isContextTooLongError(msg)) {
            return new Response(
              `Запрос слишком длинный для модели «${body.model}». ${msg}`,
              { status: 413 },
            );
          }
          return new Response(`Upstream error: ${msg}`, { status: 502 });
        }
        const text = data.choices?.[0]?.message?.content ?? "";
        return Response.json({ text, usage: data.usage ?? null, model: body.model });
      },
    },
  },
});
