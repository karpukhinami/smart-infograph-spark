import type { DesignProfile } from "@/lib/types";
import {
  COLUMN_RATIOS,
  type ProgrammaticRenderSpec,
  type RenderSpecEnvelope,
  type ValidationResult,
} from "./types";
import { parseColumnRatio } from "./layout";

function collectPaletteHex(profile: DesignProfile | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!profile) return out;
  const push = (hex: string | undefined | null) => {
    if (hex && /^#?[0-9a-fA-F]{3,8}$/.test(hex)) {
      out.add(hex.toLowerCase().replace(/^#/, ""));
    }
  };
  push(profile.colors.pageBackground);
  profile.colors.brightAccents?.forEach(push);
  profile.colors.pastelFills?.forEach(push);
  profile.colors.structural?.forEach(push);
  return out;
}

function normHex(hex: string): string {
  return hex.toLowerCase().replace(/^#/, "");
}

function err(msg: string): never {
  throw new Error(`RenderSpec: ${msg}`);
}

type AnyRecord = Record<string, unknown>;
const isObj = (v: unknown): v is AnyRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Validate the raw JSON returned by the model and return a typed RenderSpec.
 * `profile` is used only to check that all hex values are part of the palette;
 * if it is null we skip palette checks (still warn).
 */
export function validateRenderSpec(
  raw: unknown,
  profile: DesignProfile | null,
): ValidationResult {
  const warnings: string[] = [];
  if (!isObj(raw)) err("ответ не является объектом");

  const envelope = raw as Partial<RenderSpecEnvelope> & AnyRecord;
  const spec =
    (envelope.ProgrammaticRenderSpec as ProgrammaticRenderSpec | undefined) ??
    (raw as unknown as ProgrammaticRenderSpec);
  if (!isObj(spec)) err("отсутствует ProgrammaticRenderSpec");

  // format
  if (!isObj(spec.format)) err("отсутствует format");
  const orient = spec.format.orientation;
  if (orient !== "portrait" && orient !== "landscape")
    err(`format.orientation должен быть portrait или landscape, получено: ${orient}`);
  const ar = spec.format.aspectRatio;
  if (orient === "portrait" && ar !== "3:4")
    err(`portrait требует aspectRatio "3:4", получено: ${ar}`);
  if (orient === "landscape" && ar !== "4:3")
    err(`landscape требует aspectRatio "4:3", получено: ${ar}`);

  // theme/header/rows existence
  if (!isObj(spec.theme)) err("отсутствует theme");
  if (!isObj(spec.header)) err("отсутствует header");
  if (!Array.isArray(spec.rows) || spec.rows.length === 0)
    err("rows должен быть непустым массивом");

  // palette
  const palette = collectPaletteHex(profile);
  const checkColor = (c: unknown, where: string) => {
    if (c == null) return;
    if (!isObj(c) || typeof c.hex !== "string" || typeof c.role !== "string") {
      err(`${where}: ожидался объект {role, hex}`);
    }
    if (palette.size && !palette.has(normHex(c.hex as string))) {
      warnings.push(`${where}: цвет ${c.hex} отсутствует в палитре профиля`);
    }
  };

  // rows
  spec.rows.forEach((row, i) => {
    const where = `rows[${i}]`;
    if (!isObj(row)) err(`${where} не объект`);
    if (typeof row.id !== "string") err(`${where}.id обязателен`);
    if (typeof row.role !== "string") err(`${where}.role обязателен`);
    if (typeof row.heightWeight !== "number" || row.heightWeight <= 0)
      err(`${where}.heightWeight должен быть положительным числом`);
    if (typeof row.cardCount !== "number") err(`${where}.cardCount обязателен`);
    if (!(COLUMN_RATIOS as readonly string[]).includes(row.columnRatio))
      err(`${where}.columnRatio недопустим: ${row.columnRatio}`);

    const parts = parseColumnRatio(row.columnRatio);
    if (parts.length !== row.cardCount)
      err(`${where}.cardCount (${row.cardCount}) не соответствует columnRatio "${row.columnRatio}"`);
    if (!Array.isArray(row.cards) || row.cards.length !== row.cardCount)
      err(`${where}.cards.length (${row.cards?.length}) не соответствует cardCount (${row.cardCount})`);

    if (row.cardCount === 1 && row.groupContainer != null)
      err(`${where}: groupContainer запрещён при cardCount=1`);

    // cards
    row.cards.forEach((card, j) => {
      const w = `${where}.cards[${j}]`;
      if (!isObj(card)) err(`${w} не объект`);
      if ("icon" in (card as AnyRecord)) err(`${w}: поле icon запрещено`);
      if ("visual" in (card as AnyRecord)) err(`${w}: поле visual запрещено`);
      checkColor(card.background, `${w}.background`);
      checkColor(card.textColor, `${w}.textColor`);
      if (card.border) checkColor((card.border as AnyRecord).color, `${w}.border.color`);
      if (card.titleStyle) {
        checkColor((card.titleStyle as AnyRecord).background, `${w}.titleStyle.background`);
        checkColor((card.titleStyle as AnyRecord).textColor, `${w}.titleStyle.textColor`);
      }
      // formulas dollar-wrap warning
      const content = card.content as AnyRecord | undefined;
      if (content && content.formula != null) {
        const formulas = Array.isArray(content.formula)
          ? (content.formula as string[])
          : [content.formula as string];
        formulas.forEach((f, k) => {
          if (typeof f !== "string") return;
          const t = f.trim();
          if (!/^\$/.test(t) || !/\$$/.test(t))
            warnings.push(`${w}.content.formula[${k}] не обёрнут в $...$ или $$...$$`);
        });
      }
    });
  });

  // theme/header colors
  checkColor(spec.theme.pageBackground, "theme.pageBackground");
  checkColor(spec.header.titleColor, "header.titleColor");
  if (spec.header.background) checkColor(spec.header.background, "header.background");
  if (spec.header.subtitleColor) checkColor(spec.header.subtitleColor, "header.subtitleColor");

  return { spec, warnings };
}
