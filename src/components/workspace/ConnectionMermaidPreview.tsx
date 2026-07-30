import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConnectionSchemaJson } from "@/lib/types";
import { buildConnectionMermaid } from "@/lib/connection-mermaid";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Maximize2 } from "lucide-react";

interface Props {
  connection: ConnectionSchemaJson;
}

let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

const RELOAD_FLAG = "mermaid-chunk-reload";

function isChunkLoadError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Failed to fetch/i.test(msg)
  );
}

async function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = (async () => {
      let mod: typeof import("mermaid");
      try {
        mod = await import("mermaid");
      } catch (e) {
        // Устаревший кэш после деплоя: чанк с прежним хэшем больше не существует.
        if (isChunkLoadError(e) && typeof window !== "undefined") {
          if (!sessionStorage.getItem(RELOAD_FLAG)) {
            sessionStorage.setItem(RELOAD_FLAG, "1");
            window.location.reload();
          }
        }
        mermaidReady = null;
        throw e;
      }
      if (typeof window !== "undefined") sessionStorage.removeItem(RELOAD_FLAG);
      mod.default.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        htmlLabels: true,
        theme: "neutral",
        flowchart: { htmlLabels: true, useMaxWidth: true, nodeSpacing: 40, rankSpacing: 60 },
      });
      return mod.default;
    })();
  }
  return mermaidReady;
}


export function ConnectionMermaidPreview({ connection }: Props) {
  const [direction, setDirection] = useState<"TD" | "LR">("TD");
  const [svg, setSvg] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const clampZoom = useCallback(
    (z: number) => Math.min(8 * fitScale, Math.max(0.1 * fitScale, z)),
    [fitScale],
  );

  /** Вписать схему по самой широкой стороне в контейнер и считать это за 100%. */
  const fitToViewport = useCallback(() => {
    const vp = viewportRef.current;
    const host = hostRef.current;
    const el = host?.querySelector("svg") as SVGSVGElement | null;
    if (!vp || !el) return false;
    const vb = el.viewBox?.baseVal;
    const w = vb && vb.width ? vb.width : el.getBoundingClientRect().width;
    const h = vb && vb.height ? vb.height : el.getBoundingClientRect().height;
    if (!w || !h) return false;
    el.removeAttribute("style");
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
    const pad = 24;
    const availW = Math.max(1, vp.clientWidth - pad);
    const availH = Math.max(1, vp.clientHeight - pad);
    const scale = Math.min(availW / w, availH / h);
    setFitScale(scale);
    setZoom(scale);
    setPan({ x: (vp.clientWidth - w * scale) / 2, y: (vp.clientHeight - h * scale) / 2 });
    return true;
  }, []);

  const resetView = useCallback(() => {
    if (!fitToViewport()) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [fitToViewport]);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      setZoom((prev) => {
        const next = clampZoom(prev * factor);
        const k = next / prev;
        setPan((p) => ({ x: cx - k * (cx - p.x), y: cy - k * (cy - p.y) }));
        return next;
      });
    },
    [clampZoom],
  );

  const zoomByStep = useCallback(
    (factor: number) => {
      const vp = viewportRef.current;
      zoomAt(factor, vp ? vp.clientWidth / 2 : 0, vp ? vp.clientHeight / 2 : 0);
    },
    [zoomAt],
  );

  // Автовписывание после рендера SVG и при смене режима отображения.
  useEffect(() => {
    if (!svg) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        fitToViewport();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [svg, fullscreen, fitToViewport]);


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

  const renderCanvas = (heightClass: string) => (
    <div className="relative h-full w-full rounded-md border border-border bg-background">
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
          {!fullscreen && (
            <button
              type="button"
              aria-label="Развернуть на весь экран"
              title="Развернуть на весь экран"
              className="grid h-6 w-6 place-items-center rounded-full border border-border hover:bg-muted"
              onClick={() => {
                resetView();
                setFullscreen(true);
              }}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {renderError ? (
        <div className="space-y-2 p-3">
          <p className="text-xs text-destructive">Ошибка рендеринга Mermaid: {renderError}</p>
          {isChunkLoadError(renderError) && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                Похоже, страница открыта со старой версией сборки. Обновите её.
              </p>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                Обновить страницу
              </Button>
            </div>
          )}
          <pre className="overflow-auto text-xs">{built.code}</pre>
        </div>
      ) : (

        <div
          ref={viewportRef}
          className={`relative overflow-hidden p-3 ${heightClass}`}
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
  );

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

      {fullscreen ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
          Схема открыта в полноэкранном окне.
        </div>
      ) : (
        renderCanvas("h-[70vh] min-h-80")
      )}

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent
          className="max-w-none w-[98vw] h-[95vh] p-3 sm:max-w-none flex flex-col gap-2"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-sm">Схема связей (Mermaid)</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">{renderCanvas("h-full")}</div>
        </DialogContent>
      </Dialog>



      <details className="rounded-md border border-border bg-background/60 p-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Показать Mermaid-код</summary>
        <pre className="mt-2 overflow-auto text-xs">{built.code}</pre>
      </details>
    </div>
  );
}
