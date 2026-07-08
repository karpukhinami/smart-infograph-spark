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
  captureA4FitStyles,
  checkA4Overflow,
  exportA4LayoutPng,
  restoreA4FitStyles,
  runA4DomFit,
} from "@/lib/a4-layout";
import {
  renderA4CardClassName,
  renderA4CardInner,
  renderA4HeaderHtml,
} from "@/lib/a4-layout/render";
import { a4CardSurfaceClass, buildA4ProfileThemeStyle } from "@/lib/a4-layout/profile-theme";
import { downloadLayoutPng } from "@/lib/download-infographic";
import type { DesignProfile } from "@/lib/types";
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
}

function typesetFormulas(root: HTMLElement) {
  const nodes = root.querySelectorAll<HTMLElement>(".a4-formula p, .a4-side-formula");
  nodes.forEach((node) => {
    const raw = node.textContent?.trim();
    if (!raw) return;
    void import("katex").then((katex) => {
      try {
        katex.default.render(raw.replace(/^\\\(|\\\)$/g, "").replace(/^\$\$?|\$\$?$/g, ""), node, {
          throwOnError: false,
          displayMode: false,
        });
      } catch {
        /* keep raw text */
      }
    });
  });
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

  const runDomFit = useCallback(() => {
    const root = rootRef.current;
    if (!root || !active) return;
    runA4DomFit(root, rowTargets, true, screenFitOptions);
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
    const root = rootRef.current;
    if (!root) return;

    const afterTypeset = () => {
      runDomFit();
      typesetFormulas(root);
      requestAnimationFrame(() => {
        runDomFit();
      });
    };

    requestAnimationFrame(afterTypeset);
  }, [layout, rowTargets, active, profile?.profileName, screenFitOptions, runDomFit]);

  const exportPng = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame) return;
    if (!active) {
      toast.error("Откройте вкладку с макетом перед экспортом");
      return;
    }
    try {
      const root = rootRef.current;
      const shell = frame.parentElement;
      if (!root) return;

      const savedStyles = captureA4FitStyles(root);
      const prevTransform = shell?.style.transform ?? "";

      if (shell) shell.style.transform = "none";

      try {
        runA4DomFit(root, rowTargets, true, exportFitOptions);
        typesetFormulas(root);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        const dataUrl = await exportA4LayoutPng(frame);
        downloadLayoutPng(dataUrl, exportKind, summary.topic);
        toast.success("PNG сохранён");
      } finally {
        restoreA4FitStyles(savedStyles);
        if (shell) shell.style.transform = prevTransform;
        runA4DomFit(root, rowTargets, true, screenFitOptions);
        checkA4Overflow(root);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось экспортировать PNG");
    }
  }, [active, exportFitOptions, exportKind, rowTargets, screenFitOptions, summary.topic]);

  useImperativeHandle(ref, () => ({ exportPng }), [exportPng]);

  return (
    <div ref={rootRef} className="a4-auto-layout-root">
      {modeNote ? <div className={modeNoteClassName}>{modeNote}</div> : null}

      {manualErrors && manualErrors.length > 0 ? (
        <div className="a4-manual-warnings">{manualErrors.join("\n")}</div>
      ) : null}

      <div ref={viewportRef} className="a4-poster-viewport">
        <div
          className="a4-poster-scale-host"
          style={{
            width: Math.round(settings.pageWidthPx * displayScale),
            height: Math.round(settings.pageHeightPx * displayScale),
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
