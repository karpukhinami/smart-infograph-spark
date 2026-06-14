import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ProgrammaticRenderSpec, RenderRow } from "@/lib/render-spec/types";
import {
  BORDER_WIDTH,
  SHADOW_CSS,
  TEXT_SCALE,
  computeCanvas,
  gapPx,
  marginPx,
  radiusPx,
} from "@/lib/render-spec/tokens";
import { computeCardWidths, computeRowGeometries } from "@/lib/render-spec/layout";
import { Card } from "./Card";

interface Props {
  spec: ProgrammaticRenderSpec;
  /** Outer container width (CSS px). The canvas will be scaled to fit. */
  containerWidth?: number;
}

export function ProgrammaticRenderer({ spec, containerWidth }: Props) {
  const canvas = computeCanvas(spec.format.orientation);
  const m = marginPx(spec.theme.margin, canvas.base);
  const g = gapPx(spec.theme.gap, canvas.base);

  // Reserve space for the header at the top before computing row geometries.
  const headerH = headerHeightPx(spec, canvas.base);
  const rowsAreaHeight = canvas.height - headerH - (headerH > 0 ? g : 0);
  const rowsAreaY = m + headerH + (headerH > 0 ? g : 0);
  const rowGeoms = computeRowGeometries(
    spec.rows,
    rowsAreaHeight + 2 * m, // computeRowGeometries already subtracts 2*m
    m,
    g,
  ).map((r) => ({ ...r, y: r.y + headerH + (headerH > 0 ? g : 0) }));

  // Outer wrapper measures CSS width and applies transform: scale().
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      const w = wrapRef.current?.clientWidth ?? canvas.width;
      const target = containerWidth ?? w;
      setScale(Math.min(1, target / canvas.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [canvas.width, containerWidth]);

  const innerStyle: CSSProperties = {
    width: canvas.width,
    height: canvas.height,
    background: spec.theme.pageBackground.hex,
    position: "relative",
    fontFamily:
      spec.theme.typography.fontFamily ??
      "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    color: spec.theme.defaultCard.textColor.hex,
    overflow: "hidden",
  };

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        height: canvas.height * scale,
        overflow: "hidden",
      }}
      data-spec-canvas-wrap
    >
      <div
        data-spec-canvas
        style={{
          ...innerStyle,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <HeaderBlock spec={spec} canvasBase={canvas.base} canvasW={canvas.width} marginPx={m} />
        {spec.rows.map((row, i) => (
          <RowBlock
            key={row.id ?? i}
            row={row}
            y={rowGeoms[i].y}
            height={rowGeoms[i].height}
            canvasW={canvas.width}
            base={canvas.base}
            margin={m}
            gap={g}
            theme={spec.theme}
          />
        ))}
      </div>
    </div>
  );
}

function headerHeightPx(spec: ProgrammaticRenderSpec, base: number): number {
  const scale = spec.header.textScale === "display" ? TEXT_SCALE.display : TEXT_SCALE.large;
  const titleH = scale.base * scale.lineHeight;
  const subH = spec.header.subtitle ? TEXT_SCALE.normal.base * TEXT_SCALE.normal.lineHeight : 0;
  const metaH =
    spec.header.meta && spec.header.metaStyle.variant !== "none"
      ? TEXT_SCALE.small.base * TEXT_SCALE.small.lineHeight
      : 0;
  return Math.round(titleH + subH + metaH + base * 0.02);
}

function HeaderBlock({
  spec,
  canvasBase,
  canvasW,
  marginPx,
}: {
  spec: ProgrammaticRenderSpec;
  canvasBase: number;
  canvasW: number;
  marginPx: number;
}) {
  const h = spec.header;
  const titleScale = h.textScale === "display" ? TEXT_SCALE.display : TEXT_SCALE.large;
  const align = h.align === "center" ? "center" : "left";
  return (
    <div
      style={{
        position: "absolute",
        left: marginPx,
        top: marginPx,
        width: canvasW - 2 * marginPx,
        background: h.background?.hex,
        textAlign: align,
        display: "flex",
        flexDirection: "column",
        gap: canvasBase * 0.008,
      }}
    >
      <div
        style={{
          color: h.titleColor.hex,
          fontSize: titleScale.base,
          lineHeight: titleScale.lineHeight,
          fontWeight: 800,
        }}
      >
        {h.title}
      </div>
      {h.subtitle && (
        <div
          style={{
            color: h.subtitleColor.hex,
            fontSize: TEXT_SCALE.normal.base,
            lineHeight: TEXT_SCALE.normal.lineHeight,
          }}
        >
          {h.subtitle}
        </div>
      )}
      {h.meta && h.metaStyle.variant !== "none" && (
        <div
          style={{
            color: h.metaStyle.textColor.hex,
            background: h.metaStyle.background?.hex,
            alignSelf: align === "center" ? "center" : "flex-start",
            padding: h.metaStyle.variant === "pill" ? "4px 12px" : undefined,
            borderRadius: h.metaStyle.variant === "pill" ? 9999 : undefined,
            fontSize: TEXT_SCALE.small.base,
            lineHeight: TEXT_SCALE.small.lineHeight,
          }}
        >
          {h.meta}
        </div>
      )}
    </div>
  );
}

function RowBlock({
  row,
  y,
  height,
  canvasW,
  base,
  margin,
  gap,
  theme,
}: {
  row: RenderRow;
  y: number;
  height: number;
  canvasW: number;
  base: number;
  margin: number;
  gap: number;
  theme: ProgrammaticRenderSpec["theme"];
}) {
  const titleH = row.rowTitle ? Math.round(base * 0.04) : 0;
  const cardsY = titleH ? titleH + gap * 0.5 : 0;
  const cardsHeight = height - cardsY;
  const widths = computeCardWidths(row.columnRatio, canvasW, margin, gap);

  // shared/hierarchical sizing
  const [sizeMap, setSizeMap] = useState<Record<string, number>>({});
  const report = (id: string, size: number) => {
    setSizeMap((m) => (m[id] === size ? m : { ...m, [id]: size }));
  };
  let forced: number | undefined;
  if (row.textSizing === "shared" && Object.keys(sizeMap).length === row.cards.length) {
    forced = Math.min(...Object.values(sizeMap));
  }

  // group container?
  const gc = row.groupContainer;
  const gcPadding = gc ? gapPx(gc.padding, base) : 0;

  let xCursor = margin + (gc ? gcPadding : 0);
  const innerGap = gc ? gap * 0.75 : gap;
  const cardsWidthSum = widths.reduce((a, b) => a + b, 0) + innerGap * (widths.length - 1);
  // If group container is present, recompute widths to fill inner area:
  const adjusted = gc
    ? (() => {
        const innerW = canvasW - 2 * margin - 2 * gcPadding - innerGap * (widths.length - 1);
        const sumW = widths.reduce((a, b) => a + b, 0);
        return widths.map((w) => (innerW * w) / sumW);
      })()
    : widths;

  return (
    <div style={{ position: "absolute", left: 0, top: y, width: canvasW, height }}>
      {row.rowTitle && (
        <div
          style={{
            textAlign: "center",
            color: row.rowTitle.textColor.hex,
            background: row.rowTitle.background?.hex,
            fontWeight: row.rowTitle.weight === "bold" ? 700 : row.rowTitle.weight === "semibold" ? 600 : 500,
            textTransform: row.rowTitle.uppercase ? "uppercase" : "none",
            padding: row.rowTitle.variant === "pill" ? "4px 14px" : undefined,
            borderRadius: row.rowTitle.variant === "pill" ? 9999 : undefined,
            display: row.rowTitle.variant === "pill" ? "inline-block" : "block",
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            margin: "0 auto",
            width: row.rowTitle.variant === "pill" ? "max-content" : undefined,
            fontSize: TEXT_SCALE.small.base,
            lineHeight: 1.2,
          }}
        >
          {row.rowTitle.text}
        </div>
      )}
      {gc && (
        <div
          style={{
            position: "absolute",
            left: margin,
            top: cardsY,
            width: canvasW - 2 * margin,
            height: cardsHeight,
            background: gc.background?.hex,
            borderRadius: radiusPx(gc.radius === "inherit" ? theme.radius : gc.radius, canvasW, cardsHeight),
            boxShadow: SHADOW_CSS[gc.shadow],
            border: gc.border
              ? `${BORDER_WIDTH[gc.border.width](base)}px ${gc.border.style} ${gc.border.color.hex}`
              : undefined,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: margin + (gc ? gcPadding : 0),
          top: cardsY + (gc ? gcPadding : 0),
          width: canvasW - 2 * margin - (gc ? gcPadding * 2 : 0),
          height: cardsHeight - (gc ? gcPadding * 2 : 0),
          display: "flex",
          flexDirection: "row",
          gap: innerGap,
        }}
      >
        {row.cards.map((c, i) => (
          <Card
            key={c.id ?? i}
            card={c}
            theme={theme}
            width={adjusted[i]}
            height={cardsHeight - (gc ? gcPadding * 2 : 0)}
            base={base}
            reportFit={report}
            forcedBodySize={forced}
          />
        ))}
      </div>
    </div>
  );
}
