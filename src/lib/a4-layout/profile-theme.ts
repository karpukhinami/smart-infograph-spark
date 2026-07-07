import type { CSSProperties } from "react";
import type { DesignProfile, DesignProfileColors } from "@/lib/types";

const DEFAULT_COLORS: DesignProfileColors = {
  backgroundColor: "#F7F8FC",
  surfaceColor: "#FFFFFF",
  primaryColor: "#FFAA57",
  detailSoftColor: "#F8E0C9",
  detailDeepColor: "#FFD6AE",
  contrastSoftColor: "#D7D2FA",
  inkColor: "#0C1126",
  headerColor: "#293642",
  lightTextColor: "#FFFFFF",
  spotAccentColor: "#0C71C9",
  mutedheaderTextColor: "#818C96",
};

function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, "");
  if (raw.length === 3) {
    const [r, g, b] = raw.split("");
    return [
      Number.parseInt(r + r, 16),
      Number.parseInt(g + g, 16),
      Number.parseInt(b + b, 16),
    ];
  }
  if (raw.length === 6) {
    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
    ];
  }
  return null;
}

function toHex([r, g, b]: [number, number, number]): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Equal mix of two palette colors (e.g. header + light pastel for meta pill). */
export function mixHex(colorA: string, colorB: string, ratioA = 0.5): string {
  const a = parseHex(colorA);
  const b = parseHex(colorB);
  if (!a || !b) return colorA;
  const ratioB = 1 - ratioA;
  return toHex([a[0] * ratioA + b[0] * ratioB, a[1] * ratioA + b[1] * ratioB, a[2] * ratioA + b[2] * ratioB]);
}

function colorsOf(profile: DesignProfile | null | undefined): DesignProfileColors {
  return { ...DEFAULT_COLORS, ...(profile?.colors ?? {}) };
}

/** CSS custom properties for A4 layout surfaces from a design profile palette. */
export function buildA4ProfileThemeStyle(profile: DesignProfile | null | undefined): CSSProperties {
  const c = colorsOf(profile);
  const deepPastel = c.detailDeepColor || c.detailSoftColor;

  return {
    ["--a4-bg" as string]: c.backgroundColor,
    ["--a4-header-bg" as string]: c.headerColor,
    ["--a4-header-meta-bg" as string]: mixHex(c.headerColor, c.detailSoftColor, 0.5),
    ["--a4-header-title" as string]: c.lightTextColor,
    ["--a4-header-muted" as string]: c.mutedheaderTextColor,
    ["--a4-card-core" as string]: c.primaryColor,
    ["--a4-card-accent" as string]: c.contrastSoftColor,
    ["--a4-card-soft" as string]: c.detailSoftColor,
    ["--a4-card-deep" as string]: deepPastel,
    ["--a4-ink" as string]: c.inkColor,
    ["--a4-surface" as string]: c.surfaceColor,
    ["--a4-spot-accent" as string]: c.spotAccentColor,
    ["--a4-title-pill-bg" as string]: c.headerColor,
    ["--a4-title-pill-text" as string]: c.lightTextColor,
  };
}

/** Alternating pastel fill for normal-attention cards. */
export function a4CardSurfaceClass(attention?: string | null, entityIndex = 0): string {
  const a = String(attention ?? "normal").toLowerCase();
  if (a === "core" || a === "main" || a === "accent") return "";
  return entityIndex % 2 === 0 ? "is-pastel-soft" : "is-pastel-deep";
}
