/** Очистка и нормализация JSON-сцены от модели перед mergeAiScene. */
import { paletteColorFromGroup } from "../palette-color";
import type { GraphStyle } from "../types";
import type { LinePointStyle, SetStyle } from "../line/types";

type LooseStyle = Record<string, unknown>;

function omitKeys<T extends LooseStyle>(style: T, keys: string[]): LooseStyle {
  const out = { ...style };
  for (const key of keys) delete out[key];
  return out;
}

/** Убрать поля, которых модель не должна задавать. */
export function stripAiSceneMeta(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  delete obj.appearance;
  delete obj.customColors;
  return obj;
}

export function normalizeAiGraphStyle(
  imported: LooseStyle | undefined,
  defaults: GraphStyle,
  index: number,
): GraphStyle {
  const src = imported ?? {};
  const color = paletteColorFromGroup(src.colorGroup, index);
  return { ...defaults, ...omitKeys(src, ["colorGroup", "color"]), color };
}

export function normalizeAiSetStyle(
  imported: LooseStyle | undefined,
  defaults: SetStyle,
  index: number,
): SetStyle {
  const src = imported ?? {};
  const color = paletteColorFromGroup(src.colorGroup, index);
  return { ...defaults, ...omitKeys(src, ["colorGroup", "color"]), color };
}

export function normalizeAiLinePointStyle(
  imported: LooseStyle | undefined,
  defaults: LinePointStyle,
  index: number,
): LinePointStyle {
  const src = imported ?? {};
  const hasGroup = typeof src.colorGroup === "number" && Number.isFinite(src.colorGroup);
  const color = hasGroup ? paletteColorFromGroup(src.colorGroup, index) : defaults.color;
  return {
    ...defaults,
    ...omitKeys(src, ["colorGroup", "color"]),
    color,
    colorManual: hasGroup,
  };
}

export function normalizeAiPointStyle(
  imported: LooseStyle | undefined,
  defaults: { color: string },
  index: number,
): { color: string } & Omit<LooseStyle, "colorGroup" | "color"> {
  const src = imported ?? {};
  const hasGroup = typeof src.colorGroup === "number" && Number.isFinite(src.colorGroup);
  const color = hasGroup ? paletteColorFromGroup(src.colorGroup, index) : defaults.color;
  return { ...defaults, ...omitKeys(src, ["colorGroup", "color"]), color };
}
