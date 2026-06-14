// Numeric tokens for the programmatic renderer. All values come directly from
// the specification table in src/data/prompts/strict/code-based-product.txt
// and the user's renderer brief.

import type {
  CardTextScale,
  DensityToken,
  RadiusToken,
  ShadowToken,
  SpacingToken,
  TextScale,
} from "./types";

export interface DensityPreset {
  margin: SpacingToken;
  gap: SpacingToken;
  cardPaddingFactor: number;
  blockGapFactor: number;
  lineHeightMultiplier: number;
}

export const DENSITY_PRESETS: Record<DensityToken, DensityPreset> = {
  airy: {
    margin: "large",
    gap: "large",
    cardPaddingFactor: 0.075,
    blockGapFactor: 0.035,
    lineHeightMultiplier: 1.28,
  },
  balanced: {
    margin: "medium",
    gap: "medium",
    cardPaddingFactor: 0.06,
    blockGapFactor: 0.028,
    lineHeightMultiplier: 1.2,
  },
  compact: {
    margin: "small",
    gap: "small",
    cardPaddingFactor: 0.045,
    blockGapFactor: 0.02,
    lineHeightMultiplier: 1.12,
  },
};

export const MARGIN_FACTORS: Record<SpacingToken, number> = {
  small: 0.04,
  medium: 0.055,
  large: 0.07,
};

export const GAP_FACTORS: Record<SpacingToken, number> = {
  small: 0.012,
  medium: 0.018,
  large: 0.024,
};

export const RADIUS_FACTORS: Record<Exclude<RadiusToken, "pill">, {
  factor: number;
  min: number;
  max: number;
}> = {
  small: { factor: 0.045, min: 8, max: 16 },
  medium: { factor: 0.07, min: 14, max: 26 },
  large: { factor: 0.095, min: 22, max: 38 },
  xl: { factor: 0.13, min: 32, max: 56 },
};

export const BORDER_WIDTH = {
  thin: (base: number) => Math.max(1, base * 0.001),
  medium: (base: number) => Math.max(2, base * 0.0018),
};

export const SHADOW_CSS: Record<ShadowToken, string> = {
  none: "none",
  soft: "0 10px 28px rgba(16, 24, 40, 0.10)",
};

export interface TextScaleToken {
  base: number;
  min: number;
  lineHeight: number;
}

export const TEXT_SCALE: Record<TextScale, TextScaleToken> = {
  display: { base: 64, min: 42, lineHeight: 1.05 },
  large: { base: 44, min: 30, lineHeight: 1.1 },
  normal: { base: 28, min: 20, lineHeight: 1.18 },
  small: { base: 20, min: 16, lineHeight: 1.18 },
  caption: { base: 15, min: 13, lineHeight: 1.15 },
  formula: { base: 42, min: 24, lineHeight: 1.1 },
};

export const CARD_TEXT_SCALES: Record<CardTextScale, TextScaleToken> = {
  display: TEXT_SCALE.display,
  large: TEXT_SCALE.large,
  normal: TEXT_SCALE.normal,
  small: TEXT_SCALE.small,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface CanvasSize {
  width: number;
  height: number;
  base: number;
}

export function computeCanvas(orientation: "portrait" | "landscape"): CanvasSize {
  if (orientation === "landscape") {
    return { width: 1600, height: 1200, base: 1200 };
  }
  return { width: 1200, height: 1600, base: 1200 };
}

export function marginPx(token: SpacingToken, base: number): number {
  return base * MARGIN_FACTORS[token];
}

export function gapPx(token: SpacingToken, base: number): number {
  return base * GAP_FACTORS[token];
}

export function radiusPx(token: RadiusToken, cardW: number, cardH: number): number {
  if (token === "pill") return 9999;
  const t = RADIUS_FACTORS[token];
  return clamp(Math.min(cardW, cardH) * t.factor, t.min, t.max);
}

export function cardPaddingPx(
  density: DensityToken,
  cardW: number,
  cardH: number,
): number {
  return clamp(
    Math.min(cardW, cardH) * DENSITY_PRESETS[density].cardPaddingFactor,
    16,
    44,
  );
}

export function blockGapPx(
  density: DensityToken,
  cardW: number,
  cardH: number,
): number {
  return clamp(
    Math.min(cardW, cardH) * DENSITY_PRESETS[density].blockGapFactor,
    8,
    28,
  );
}

export interface AddOnVariantPreset {
  paddingFactor: number;
  radius: RadiusToken;
}

export const ADD_ON_VARIANTS: Record<"inset" | "badge" | "plate", AddOnVariantPreset> = {
  inset: { paddingFactor: 0.045, radius: "medium" },
  badge: { paddingFactor: 0.035, radius: "pill" },
  plate: { paddingFactor: 0.05, radius: "medium" },
};

export function addOnPaddingPx(
  variant: "inset" | "badge" | "plate",
  w: number,
  h: number,
): number {
  return clamp(
    Math.min(w, h) * ADD_ON_VARIANTS[variant].paddingFactor,
    8,
    24,
  );
}
