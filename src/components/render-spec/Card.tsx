import { type CSSProperties, useMemo, useRef } from "react";
import type { RenderCard, RenderTheme } from "@/lib/render-spec/types";
import {
  BORDER_WIDTH,
  CARD_TEXT_SCALES,
  DENSITY_PRESETS,
  SHADOW_CSS,
  blockGapPx,
  cardPaddingPx,
  radiusPx,
} from "@/lib/render-spec/tokens";
import { MdBlock } from "./MdBlock";
import { AddOn } from "./AddOn";
import { useFitText } from "@/lib/render-spec/fit-text";

interface Props {
  card: RenderCard;
  theme: RenderTheme;
  width: number;
  height: number;
  base: number;
  reportFit?: (id: string, size: number) => void;
  forcedBodySize?: number;
}

export function Card({ card, theme, width, height, base, reportFit, forcedBodySize }: Props) {
  const density =
    card.contentDensity === "inherit" ? theme.density : card.contentDensity;
  const preset = DENSITY_PRESETS[density];
  const padding = cardPaddingPx(density, width, height);
  const blockGap = blockGapPx(density, width, height);
  const radiusToken = card.radius === "inherit" ? theme.radius : card.radius;
  const radius = radiusPx(radiusToken, width, height);
  const scale = CARD_TEXT_SCALES[card.textScale];

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const fitDeps = useMemo(
    () => [width, height, JSON.stringify(card.content)],
    [width, height, card.content],
  );

  const measured = useFitText({
    containerRef,
    contentRef: measureRef,
    baseFontSize: scale.base,
    minFontSize: scale.min,
    lineHeight: scale.lineHeight * preset.lineHeightMultiplier,
    deps: fitDeps,
    onMeasured: (s) => reportFit?.(card.id, s),
  });

  const bodyFontSize = forcedBodySize ?? measured;

  const titleStyle = card.titleStyle;
  const titleSize = bodyFontSize * (titleStyle?.sizeRatio ?? 1.15);

  const style: CSSProperties = {
    width,
    height,
    boxSizing: "border-box",
    background: card.background.hex,
    color: card.textColor.hex,
    boxShadow: SHADOW_CSS[card.shadow],
    borderRadius: radius,
    padding,
    display: "flex",
    flexDirection: "column",
    gap: blockGap,
    overflow: "hidden",
    justifyContent:
      card.fillStrategy === "centerContent" ? "center" : "flex-start",
  };
  if (card.border) {
    style.border = `${BORDER_WIDTH[card.border.width](base)}px ${card.border.style} ${card.border.color.hex}`;
  }

  const showTitle =
    titleStyle.variant !== "none" && card.content.title && card.content.title.trim().length > 0;

  return (
    <div style={style}>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: blockGap,
          overflow: "hidden",
        }}
      >
        <div ref={measureRef} style={{ fontSize: bodyFontSize, lineHeight: scale.lineHeight * preset.lineHeightMultiplier, display: "flex", flexDirection: "column", gap: blockGap }}>
          {showTitle && (
            <div
              style={{
                fontSize: titleSize,
                fontWeight: weightNum(titleStyle.weight),
                textTransform: titleStyle.uppercase ? "uppercase" : "none",
                color: titleStyle.textColor?.hex ?? card.textColor.hex,
                background: titleStyle.background?.hex,
                padding: titleStyle.variant === "plate" || titleStyle.variant === "pill" ? `${blockGap * 0.4}px ${blockGap}px` : undefined,
                borderRadius: titleStyle.variant === "pill" ? 9999 : titleStyle.variant === "plate" ? radius * 0.5 : undefined,
                alignSelf: titleStyle.variant === "pill" ? "flex-start" : undefined,
                lineHeight: 1.15,
              }}
            >
              {card.content.title}
            </div>
          )}
          {card.content.body != null && <MdBlock source={card.content.body} />}
          {card.content.formula != null && card.formulaPlacement && (
            <AddOn
              placement={card.formulaPlacement}
              content={card.content.formula}
              base={base}
              cardWidth={width}
              cardHeight={height}
            />
          )}
          {card.content.example != null && card.examplePlacement && (
            <AddOn
              placement={card.examplePlacement}
              content={card.content.example}
              base={base}
              cardWidth={width}
              cardHeight={height}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function weightNum(w: "medium" | "semibold" | "bold" | "extrabold"): number {
  return { medium: 500, semibold: 600, bold: 700, extrabold: 800 }[w];
}
