import { useEffect, useMemo, useRef, useState } from "react";
import type { ConnectionSchemaJson } from "@/lib/types";
import { buildConnectionMermaid } from "@/lib/connection-mermaid";
import { Button } from "@/components/ui/button";

interface Props {
  connection: ConnectionSchemaJson;
}

let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

async function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        htmlLabels: true,
        theme: "neutral",
        flowchart: { htmlLabels: true, useMaxWidth: true, nodeSpacing: 40, rankSpacing: 60 },
      });
      return m.default;
    });
  }
  return mermaidReady;
}

export function ConnectionMermaidPreview({ connection }: Props) {
  const [direction, setDirection] = useState<"TD" | "LR">("TD");
  const [svg, setSvg] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const built = useMemo(() => buildConnectionMermaid(connection, direction), [connection, direction]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await getMermaid();
        const id = `cmm-${Math.random().toString(36).slice(2)}`;
        const { svg: out } = await mermaid.render(id, built.code);
        if (!cancelled) {
          setSvg(out);
          setRenderError(null);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.error("[mermaid] render failed\n", msg, "\n--- code ---\n", built.code);
        if (!cancelled) {
          setSvg("");
          setRenderError(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [built]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Техническая схема связей (Mermaid) — проверка состава и связей, не финальный дизайн.
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={direction === "TD" ? "secondary" : "outline"}
            onClick={() => setDirection("TD")}
          >
            Сверху вниз
          </Button>
          <Button
            size="sm"
            variant={direction === "LR" ? "secondary" : "outline"}
            onClick={() => setDirection("LR")}
          >
            Слева направо
          </Button>
        </div>
      </div>

      {(built.errors.length > 0 || built.warnings.length > 0) && (
        <div className="rounded-md border border-border bg-muted/40 p-2 text-xs space-y-1">
          {built.errors.map((e, i) => (
            <div key={`e${i}`} className="text-destructive">⛔ {e}</div>
          ))}
          {built.warnings.map((w, i) => (
            <div key={`w${i}`} className="text-muted-foreground">⚠ {w}</div>
          ))}
        </div>
      )}

      <div className="w-full overflow-auto rounded-md border border-border bg-background p-3">
        {renderError ? (
          <div className="space-y-2">
            <p className="text-xs text-destructive">Ошибка рендеринга Mermaid: {renderError}</p>
            <pre className="overflow-auto text-xs">{built.code}</pre>
          </div>
        ) : (
          <div ref={hostRef} className="[&_svg]:max-w-none" dangerouslySetInnerHTML={{ __html: svg }} />
        )}
      </div>

      <details className="rounded-md border border-border bg-background/60 p-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Показать Mermaid-код</summary>
        <pre className="mt-2 overflow-auto text-xs">{built.code}</pre>
      </details>
    </div>
  );
}
