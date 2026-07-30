import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const clampZoom = (z: number) => Math.min(8, Math.max(0.2, z));

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setZoom((prev) => {
      const next = clampZoom(prev * factor);
      const k = next / prev;
      setPan((p) => ({ x: cx - k * (cx - p.x), y: cy - k * (cy - p.y) }));
      return next;
    });
  }, []);

  const zoomByStep = useCallback(
    (factor: number) => {
      const vp = viewportRef.current;
      zoomAt(factor, vp ? vp.clientWidth / 2 : 0, vp ? vp.clientHeight / 2 : 0);
    },
    [zoomAt],
  );

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [zoomAt, svg]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    setIsPanning(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = panStart.current;
    if (!s) return;
    setPan({ x: s.px + (e.clientX - s.x), y: s.py + (e.clientY - s.y) });
  };
  const endPan = () => {
    panStart.current = null;
    setIsPanning(false);
  };

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

      <div className="relative w-full rounded-md border border-border bg-background">
        {!renderError && (
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border border-border bg-background/90 px-1.5 py-1 shadow-sm backdrop-blur">
            <button
              type="button"
              aria-label="Уменьшить"
              className="grid h-6 w-6 place-items-center rounded-full border border-border text-sm leading-none hover:bg-muted"
              onClick={() => zoomByStep(1 / 1.25)}
            >
              −
            </button>
            <span className="min-w-10 text-center text-[11px] tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Увеличить"
              className="grid h-6 w-6 place-items-center rounded-full border border-border text-sm leading-none hover:bg-muted"
              onClick={() => zoomByStep(1.25)}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Сбросить масштаб"
              className="grid h-6 w-6 place-items-center rounded-full border border-border text-xs leading-none hover:bg-muted"
              onClick={resetView}
            >
              ⟲
            </button>
          </div>
        )}

        {renderError ? (
          <div className="space-y-2 p-3">
            <p className="text-xs text-destructive">Ошибка рендеринга Mermaid: {renderError}</p>
            <pre className="overflow-auto text-xs">{built.code}</pre>
          </div>
        ) : (
          <div
            ref={viewportRef}
            className="relative h-[70vh] min-h-80 overflow-hidden p-3"
            style={{ cursor: isPanning ? "grabbing" : "grab", touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onDoubleClick={resetView}
          >
            <div
              ref={hostRef}
              className="[&_svg]:max-w-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "top left",
                width: "max-content",
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        )}
      </div>


      <details className="rounded-md border border-border bg-background/60 p-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Показать Mermaid-код</summary>
        <pre className="mt-2 overflow-auto text-xs">{built.code}</pre>
      </details>
    </div>
  );
}
