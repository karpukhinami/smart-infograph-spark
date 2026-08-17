/**
 * Palette-driven color assignment for stat-deco reference charts.
 *
 * The analysis model never returns concrete colors — only a `colorMode`
 * ("same" | "similar" | "different"). All actual hexes are derived here from the
 * currently selected design profile, so switching a profile re-colors the chart.
 */
import type { DesignProfile } from "@/lib/types";
import type { StatDecoColorMode } from "@/lib/types";
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "@/lib/palette-math";

export interface StatDecoTheme {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  header: string;
  primary: string;
  spot: string;
  /** Ordered pool of distinct palette colors used for "different" mode. */
  distinct: string[];
}

const FALLBACK: StatDecoTheme = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  ink: "#0C1126",
  muted: "#818C96",
  header: "#293642",
  primary: "#FFAA57",
  spot: "#0C71C9",
  distinct: ["#FFAA57", "#0C71C9", "#D7D2FA", "#FFD6AE", "#293642"],
};

export function statDecoTheme(profile: DesignProfile | null | undefined): StatDecoTheme {
  const c = profile?.colors;
  if (!c) return FALLBACK;
  return {
    background: c.backgroundColor || FALLBACK.background,
    surface: c.surfaceColor || FALLBACK.surface,
    ink: c.inkColor || FALLBACK.ink,
    muted: c.mutedheaderTextColor || FALLBACK.muted,
    header: c.headerColor || FALLBACK.header,
    primary: c.primaryColor || FALLBACK.primary,
    spot: c.spotAccentColor || FALLBACK.spot,
    distinct: [
      c.primaryColor,
      c.spotAccentColor,
      c.contrastSoftColor,
      c.detailDeepColor,
      c.headerColor,
      c.detailSoftColor,
    ].filter((x): x is string => !!x),
  };
}

function shiftHsl(hex: string, dH: number, dS: number, dL: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const nl = Math.min(92, Math.max(12, l + dL));
  const ns = Math.min(100, Math.max(6, s + dS));
  const rgb = hslToRgb(h + dH, ns, nl);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/** Lighten a hex by a fraction (0..1) — used for pseudo-3D top faces. */
export function lighten(hex: string, amount: number): string {
  return shiftHsl(hex, 0, 0, Math.round(amount * 100));
}

/** Darken a hex by a fraction (0..1) — used for pseudo-3D side faces. */
export function darken(hex: string, amount: number): string {
  return shiftHsl(hex, 0, 0, -Math.round(amount * 100));
}

/** Shades of one base color, evenly spread in lightness (for "similar"). */
function shades(base: string, count: number): string[] {
  if (count <= 1) return [base];
  const out: string[] = [];
  const span = 34; // total lightness spread in percent
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    out.push(shiftHsl(base, (t - 0.5) * 14, 0, Math.round((0.5 - t) * span)));
  }
  return out;
}

/** Distinct colors: palette pool first, then hue-rotated variants of primary. */
function distinctColors(theme: StatDecoTheme, count: number): string[] {
  const out = theme.distinct.slice(0, count);
  let step = 1;
  while (out.length < count) {
    out.push(shiftHsl(theme.primary, (step * 360) / (count + 1), 0, step % 2 ? -8 : 8));
    step += 1;
  }
  return out;
}

/**
 * Resolve `count` colors for the given colorMode.
 * `count` is the number of series when there are several, otherwise the number
 * of categories inside a single series.
 */
export function resolveColors(
  theme: StatDecoTheme,
  mode: StatDecoColorMode | undefined,
  count: number,
): string[] {
  const n = Math.max(1, count);
  const effective: StatDecoColorMode = mode ?? (n > 1 ? "different" : "same");
  if (effective === "same") return Array.from({ length: n }, () => theme.primary);
  if (effective === "similar") return shades(theme.primary, n);
  return distinctColors(theme, n);
}

/** Functional colors for waterfall roles (role coding overrides colorMode). */
export function waterfallColors(theme: StatDecoTheme) {
  return {
    increase: theme.primary,
    decrease: theme.spot,
    subtotal: theme.header,
    total: theme.header,
  };
}
