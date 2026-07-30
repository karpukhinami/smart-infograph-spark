import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { A4AutoLayoutResult } from "@/lib/a4-layout";
import {
  A4_DOM_FIT_EXPORT_OPTIONS,
  A4_DOM_FIT_SCREEN_OPTIONS,
  checkA4Overflow,
  exportA4LayoutPng,
  runA4DomFit,
} from "@/lib/a4-layout";
import { needsA4FormulaTypeset, refitA4BlockFormulas, typesetA4FormulasAndWait } from "@/lib/a4-layout/katex-typeset";
import {
  renderA4CardClassName,
  renderA4CardInner,
  renderA4HeaderHtml,
} from "@/lib/a4-layout/render";
import { a4CardSurfaceClass, buildA4ProfileThemeStyle } from "@/lib/a4-layout/profile-theme";
import { downloadLayoutPng } from "@/lib/download-infographic";
import type { DesignProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import "@/lib/a4-layout/a4-auto-layout.css";

export interface A4LayoutCanvasHandle {
  exportPng: () => Promise<void>;
}

interface Props {
  layout: A4AutoLayoutResult;
  active: boolean;
  profile?: DesignProfile | null;
  modeNote?: string;
  modeNoteClassName?: string;
  manualErrors?: string[];
  /** Prefix for exported PNG filename, e.g. «авто-макет». */
  exportKind?: string;
  /** When false, span.accent uses accent color only (no filled background). */
  accentHighlightText?: boolean;
}

export const A4LayoutCanvas = forwardRef<A4LayoutCanvasHandle, Props>(function A4LayoutCanvas(
  {
    layout,
    active,
    profile = null,
    modeNote,
    modeNoteClassName = "a4-layout-mode-note",
    manualErrors,
    exportKind = "макет",
    accentHighlightText = true,
  },
  ref,
) {
  const { summary, plan, settings, rowTargets, domFitOptions } = layout;
  const renderOptions = useMemo(
    () => ({ allowAddendumRight: domFitOptions?.allowAddendumRight !== false }),
    [domFitOptions?.allowAddendumRight],
  );
  const profileTheme = useMemo(() => buildA4ProfileThemeStyle(profile), [profile]);
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const clampZoom = (z: number) => Math.min(6, Math.max(1, z));

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setZoom((prevZoom) => {
        const next = clampZoom(prevZoom * Math.exp(-e.deltaY * 0.0015));
        setPan((prevPan) => {
          if (next <= 1) return { x: 0, y: 0 };
          const k = next / prevZoom;
          return { x: cx - k * (cx - prevPan.x), y: cy - k * (cy - prevPan.y) };
        });
        return next;
      });
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (zoom <= 1) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      setIsPanning(true);
    },
    [pan.x, pan.y, zoom],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const start = panStart.current;
    if (!start) return;
    setPan({ x: start.px + (e.clientX - start.x), y: start.py + (e.clientY - start.y) });
  }, []);

  const endPan = useCallback(() => {
    panStart.current = null;
    setIsPanning(false);
  }, []);

  const screenFitOptions = useMemo(
    () => ({
      ...A4_DOM_FIT_SCREEN_OPTIONS,
      allowAddendumRight: domFitOptions?.allowAddendumRight !== false,
      balanceRowFonts: domFitOptions?.balanceRowFonts !== false,
    }),
    [domFitOptions?.allowAddendumRight, domFitOptions?.balanceRowFonts],
  );

  const exportFitOptions = useMemo(
    () => ({
      ...A4_DOM_FIT_EXPORT_OPTIONS,
      allowAddendumRight: domFitOptions?.allowAddendumRight !== false,
      balanceRowFonts: domFitOptions?.balanceRowFonts !== false,
    }),
    [domFitOptions?.allowAddendumRight, domFitOptions?.balanceRowFonts],
  );

  const runLayoutSync = useCallback(async () => {
    const root = rootRef.current;
    if (!root) return;
    await typesetA4FormulasAndWait(root);
    if (!active) return;
    runA4DomFit(root, rowTargets, true, screenFitOptions);
    checkA4Overflow(root);
    refitA4BlockFormulas(root);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (!rootRef.current || !active) return;
    runA4DomFit(root, rowTargets, true, screenFitOptions);
    refitA4BlockFormulas(root);
    checkA4Overflow(root);
  }, [active, rowTargets, screenFitOptions]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateScale = () => {
      const width = viewport.clientWidth;
      if (width <= 0) return;
      const next = width / settings.pageWidthPx;
      setDisplayScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [settings.pageWidthPx]);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      await runLayoutSync();
      if (cancelled) return;
      const root = rootRef.current;
      if (!root || !needsA4FormulaTypeset(root)) return;
      await typesetA4FormulasAndWait(root);
      if (cancelled || !active || !rootRef.current) return;
      runA4DomFit(root, rowTargets, true, screenFitOptions);
      refitA4BlockFormulas(root);
      checkA4Overflow(root);
    };

    requestAnimationFrame(() => {
      void sync();
    });

    return () => {
      cancelled = true;
    };
  }, [layout, rowTargets, active, profile?.profileName, screenFitOptions, runLayoutSync]);

  const exportPng = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame) return;
    if (!active) {
      toast.error("Откройте вкладку с макетом перед экспортом");
      return;
    }

    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, {
      position: "fixed",
      left: "-20000px",
      top: "0",
      width: `${settings.pageWidthPx}px`,
      height: `${settings.pageHeightPx}px`,
      overflow: "visible",
      opacity: "0",
      pointerEvents: "none",
    });

    const wrapper = document.createElement("div");
    wrapper.className = cn("a4-auto-layout-root", !accentHighlightText && "a4-accent-plain");
    const clone = frame.cloneNode(true) as HTMLElement;
    wrapper.appendChild(clone);
    host.appendChild(wrapper);
    document.body.appendChild(host);

    try {
      runA4DomFit(clone, rowTargets, true, exportFitOptions);
      await typesetA4FormulasAndWait(clone);
      runA4DomFit(clone, rowTargets, true, exportFitOptions);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const dataUrl = await exportA4LayoutPng(clone);
      downloadLayoutPng(dataUrl, exportKind, summary.topic);
      toast.success("PNG сохранён");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось экспортировать PNG");
    } finally {
      document.body.removeChild(host);
    }
  }, [accentHighlightText, active, exportFitOptions, exportKind, rowTargets, settings.pageHeightPx, settings.pageWidthPx, summary.topic]);

  useImperativeHandle(ref, () => ({ exportPng }), [exportPng]);

  return (
    <div
      ref={rootRef}
      className={cn("a4-auto-layout-root", !accentHighlightText && "a4-accent-plain")}
    >
      {modeNote ? <div className={modeNoteClassName}>{modeNote}</div> : null}

      {manualErrors && manualErrors.length > 0 ? (
        <div className="a4-manual-warnings">{manualErrors.join("\n")}</div>
      ) : null}

      <div className="a4-zoom-wrap">
        <div className="a4-zoom-controls">
          <button type="button" aria-label="Уменьшить" onClick={() => zoomByStep(1 / 1.25)}>
            −
          </button>
          <span className="a4-zoom-value">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Увеличить" onClick={() => zoomByStep(1.25)}>
            +
          </button>
          <button type="button" aria-label="Сбросить масштаб" className="a4-zoom-reset" onClick={resetView}>
            ⟲
          </button>
        </div>

        <div
          ref={viewportRef}
          className="a4-poster-viewport"
          style={{
            overflow: zoom > 1 ? "hidden" : "auto",
            cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default",
            touchAction: zoom > 1 ? "none" : undefined,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onDoubleClick={resetView}
        >
        <div
          className="a4-poster-scale-host"
          style={{
            width: Math.round(settings.pageWidthPx * displayScale),
            height: Math.round(settings.pageHeightPx * displayScale),
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          <div
            className="poster-shell"
            style={{
              transform: `scale(${displayScale})`,
              transformOrigin: "top left",
              width: settings.pageWidthPx,
              height: settings.pageHeightPx,
            }}
          >
            <div
              ref={frameRef}
              className="poster-frame a4-clean"
              data-a4-layout-frame="1"
              style={{
                ...profileTheme,
                ["--a4-page-h" as string]: `${settings.pageHeightPx}px`,
                ["--a4-gap" as string]: `${rowTargets.rowGap}px`,
                width: settings.pageWidthPx,
                minWidth: settings.pageWidthPx,
                height: settings.pageHeightPx,
                minHeight: settings.pageHeightPx,
                padding: settings.outerMarginPx,
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: renderA4HeaderHtml(summary, rowTargets.headerHeight, settings) }} />
              <div
                className="a4-card-area"
                style={{
                  gap: rowTargets.rowGap,
                  height: rowTargets.availableRowsHeight,
                  marginTop: rowTargets.headerGap,
                }}
              >
                {plan.rows.map((row, rowIndex) => {
                  const rowHeight = Math.max(34, Math.round(rowTargets.targetHeights[rowIndex]));
                  return (
                    <div
                      key={rowIndex}
                      className="a4-row"
                      data-est-height={Math.round(row.rowHeight)}
                      data-fixed-height={rowHeight}
                      style={{
                        gridTemplateColumns: row.fractions.map((f) => `minmax(0, ${f}fr)`).join(" "),
                        height: rowHeight,
                        minHeight: rowHeight,
                        maxHeight: rowHeight,
                      }}
                    >
                      {row.cards.map((card, i) => (
                        <article
                          key={card.entityIndex}
                          className={[
                            renderA4CardClassName(card.sourceEntity, row.reports[i], row.fractions[i], renderOptions),
                            a4CardSurfaceClass(card.sourceEntity.attention, card.entityIndex),
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          data-a4-fit-card="1"
                          dangerouslySetInnerHTML={{
                            __html: renderA4CardInner(card.sourceEntity, row.reports[i], row.fractions[i], renderOptions),
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
