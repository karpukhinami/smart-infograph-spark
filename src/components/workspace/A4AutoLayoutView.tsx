import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisJson } from "@/lib/types";
import {
  buildA4AutoLayout,
  checkA4Overflow,
  renderA4CardClassName,
  renderA4CardInner,
  renderA4HeaderHtml,
  runA4DomFit,
} from "@/lib/a4-layout";
import "@/lib/a4-layout/a4-auto-layout.css";

interface Props {
  analysis: AnalysisJson;
  /** When false, DOM fit is deferred until the tab becomes visible. */
  active: boolean;
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

export function A4AutoLayoutView({ analysis, active }: Props) {
  const layout = useMemo(() => buildA4AutoLayout(analysis), [analysis]);
  const { summary, plan, settings, rowTargets } = layout;
  const rootRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState("");
  const [overflowText, setOverflowText] = useState("");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const runFit = () => {
      const msg = runA4DomFit(root, rowTargets, active);
      setMetrics(msg);
      const problems = checkA4Overflow(root);
      setOverflowText(problems.length ? `Переполнение осталось в отдельных фиксированных окнах:\n${problems.join("\n")}` : "");
    };

    const afterTypeset = () => {
      runFit();
      typesetFormulas(root);
      requestAnimationFrame(() => {
        runFit();
        const problems = checkA4Overflow(root);
        setOverflowText(problems.length ? `Переполнение осталось в отдельных фиксированных окнах:\n${problems.join("\n")}` : "");
      });
    };

    requestAnimationFrame(afterTypeset);
  }, [layout, rowTargets, active]);

  const cardCount = plan.rows.reduce((sum, row) => sum + row.cards.length, 0);

  return (
    <div ref={rootRef} className="a4-auto-layout-root">
      <div className="a4-summary-cards">
        <div className="a4-metric">
          <strong>{settings.pageWidthPx}×{settings.pageHeightPx}</strong>
          <span>A4 frame, px</span>
        </div>
        <div className="a4-metric">
          <strong>{Math.round(rowTargets.headerHeight)}</strong>
          <span>шапка, px</span>
        </div>
        <div className="a4-metric">
          <strong>{plan.rows.length}</strong>
          <span>рядов</span>
        </div>
        <div className="a4-metric">
          <strong>{cardCount}</strong>
          <span>карточек</span>
        </div>
        <div className="a4-metric">
          <strong>{plan.verdict}</strong>
          <span>fit по расчёту</span>
        </div>
      </div>

      <div className="poster-shell">
        <div
          className="poster-frame a4-clean"
          style={{
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
                      className={renderA4CardClassName(card.sourceEntity, row.reports[i], row.fractions[i])}
                      data-a4-fit-card="1"
                      dangerouslySetInnerHTML={{
                        __html: renderA4CardInner(card.sourceEntity, row.reports[i], row.fractions[i]),
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {metrics ? <div className="a4-dom-metrics">{metrics}</div> : null}
      {overflowText ? <div className="a4-overflow-summary">{overflowText}</div> : null}
    </div>
  );
}
