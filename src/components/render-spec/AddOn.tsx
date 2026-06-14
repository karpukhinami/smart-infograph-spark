import type { CSSProperties } from "react";
import { MdBlock } from "./MdBlock";
import type { AddOnContainer, AddOnPlacement } from "@/lib/render-spec/types";
import {
  ADD_ON_VARIANTS,
  BORDER_WIDTH,
  TEXT_SCALE,
  addOnPaddingPx,
  clamp,
  radiusPx,
} from "@/lib/render-spec/tokens";

interface Props {
  placement: AddOnPlacement;
  content: string | string[];
  base: number;
  cardWidth: number;
  cardHeight: number;
}

function variantStyles(
  container: AddOnContainer,
  base: number,
  cardW: number,
  cardH: number,
): CSSProperties {
  const v = container.variant;
  const padding = addOnPaddingPx(v, cardW, cardH);
  const radius = radiusPx(ADD_ON_VARIANTS[v].radius, cardW, cardH);
  const style: CSSProperties = {
    padding: `${padding}px ${padding * 1.2}px`,
    borderRadius: radius,
    display: "flex",
    flexDirection: container.layout === "horizontalGroup" ? "row" : "column",
    gap: clamp(base * 0.012, 6, 18),
    alignItems: container.align === "center" ? "center" : "flex-start",
    justifyContent: container.align === "center" ? "center" : "flex-start",
    textAlign: container.align === "center" ? "center" : "left",
  };
  if (container.background) style.background = container.background.hex;
  if (container.border) {
    style.border = `${BORDER_WIDTH[container.border.width](base)}px ${container.border.style} ${container.border.color.hex}`;
  }
  return style;
}

export function AddOn({ placement, content, base, cardWidth, cardHeight }: Props) {
  const items = Array.isArray(content) ? content : [content];
  if (placement.mode === "inline" || !placement.container) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((s, i) => (
          <MdBlock key={i} source={s} />
        ))}
      </div>
    );
  }
  const c = placement.container;
  const scale = TEXT_SCALE[c.textScale];
  const baseStyle = variantStyles(c, base, cardWidth, cardHeight);
  return (
    <div
      style={{
        ...baseStyle,
        fontSize: scale.base,
        lineHeight: scale.lineHeight,
      }}
    >
      {items.map((s, i) => (
        <div key={i} style={{ flex: c.layout === "horizontalGroup" ? 1 : undefined }}>
          <MdBlock source={s} />
        </div>
      ))}
    </div>
  );
}
