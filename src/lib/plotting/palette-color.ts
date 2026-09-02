import { PLOT_PALETTE } from "./scene";

/** Подписи для промптов ИИ (colorGroup 1…6). */
export const PLOT_COLOR_GROUP_LABELS = [
  "1 — синий",
  "2 — оранжевый",
  "3 — розовый",
  "4 — фиолетовый",
  "5 — зелёный",
  "6 — бирюзовый",
] as const;

/** Цвет палитры по номеру группы (1-based) или порядковому index (1-based fallback). */
export function paletteColorFromGroup(colorGroup: unknown, fallbackIndex: number): string {
  const group =
    typeof colorGroup === "number" && Number.isFinite(colorGroup)
      ? Math.round(colorGroup)
      : fallbackIndex;
  const idx = (Math.max(1, group) - 1) % PLOT_PALETTE.length;
  return PLOT_PALETTE[idx]!;
}
