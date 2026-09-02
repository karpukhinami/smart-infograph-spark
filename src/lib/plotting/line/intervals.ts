/**
 * Разбор и нормализация множеств на числовой прямой.
 */
import { decimalComma, evaluateNumber, exactDisplay, normalizeInput, parseBound } from "../math-expr";
import type { SetMath } from "./types";

export interface ParsedInterval {
  left: number;
  right: number;
  leftInclusive: boolean;
  rightInclusive: boolean;
}

export interface ParseResult {
  parts: ParsedInterval[];
  displayText: string;
  latexText: string;
  error: string | null;
}

const EPS = 1e-9;

function intervalDisplay(part: ParsedInterval): string {
  const left = part.left === -Infinity ? "−∞" : exactDisplay(part.left);
  const right = part.right === Infinity ? "+∞" : exactDisplay(part.right);
  const lb = part.leftInclusive ? "[" : "(";
  const rb = part.rightInclusive ? "]" : ")";
  return `${lb}${left}; ${right}${rb}`;
}

function formatSetDisplay(parts: ParsedInterval[]): string {
  return parts.map(intervalDisplay).join(" ∪ ");
}

function formatSetLatex(parts: ParsedInterval[]): string {
  return parts
    .map((part) => {
      const lb = part.leftInclusive ? "\\left[" : "\\left(";
      const rb = part.rightInclusive ? "\\right]" : "\\right)";
      const left = part.left === -Infinity ? "-\\infty" : String(part.left);
      const right = part.right === Infinity ? "+\\infty" : String(part.right);
      return `${lb}${left};\\ ${right}${rb}`;
    })
    .join(" \\cup ");
}

function semicolonAtDepthZero(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === ";" && depth === 0) return i;
  }
  return -1;
}

export function splitIntervalList(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "(" || ch === "[") {
      depth++;
      current += ch;
    } else if (ch === ")" || ch === "]") {
      depth--;
      current += ch;
    } else if (ch === ";" && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseEndpoint(raw: string, bracket: "(" | "[" | ")" | "]"): { value: number; inclusive: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Пустая граница интервала.");
  const value = parseBound(trimmed);
  const inclusive = bracket === "[" || bracket === "]";
  if (Math.abs(value) === Infinity && inclusive) {
    throw new Error("Бесконечность может быть только открытой границей.");
  }
  return { value, inclusive };
}

export function parseSingleInterval(text: string): ParsedInterval {
  const t = text.trim();
  if (t.length < 5) throw new Error(`Некорректный интервал «${text}».`);
  const open = t[0];
  const close = t[t.length - 1];
  if (!"([ ".includes(open) || !")]".includes(close)) {
    throw new Error("Интервал должен начинаться с «(» или «[» и заканчиваться «)» или «]».");
  }
  const inner = t.slice(1, -1);
  const sep = semicolonAtDepthZero(inner);
  if (sep < 0) throw new Error(`Внутри «${text}» должна быть ровно одна «;» между границами.`);
  const leftRaw = inner.slice(0, sep).trim();
  const rightRaw = inner.slice(sep + 1).trim();
  if (!leftRaw || !rightRaw) throw new Error("Обе границы интервала обязательны.");
  const left = parseEndpoint(leftRaw, open as "(" | "[");
  const right = parseEndpoint(rightRaw, close as ")" | "]");
  if (left.value > right.value + EPS) throw new Error("Левая граница правее правой.");
  if (Math.abs(left.value - right.value) < EPS && !(left.inclusive && right.inclusive)) {
    throw new Error("Вырожденный интервал: общая точка должна быть включена с обеих сторон.");
  }
  return {
    left: left.value,
    right: right.value,
    leftInclusive: left.inclusive,
    rightInclusive: right.inclusive,
  };
}

export function parseFreeformInput(input: string): ParsedInterval[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Введите запись множества.");
  const chunks = splitIntervalList(trimmed);
  if (!chunks.length) throw new Error("Не найдено ни одного интервала.");
  return chunks.map(parseSingleInterval);
}

export function normalizeIntervals(parts: ParsedInterval[]): ParsedInterval[] {
  if (!parts.length) return [];
  const sorted = [...parts].sort((a, b) => a.left - b.left);
  const merged: ParsedInterval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const last = merged[merged.length - 1];

    if (next.left > last.right + EPS) {
      merged.push({ ...next });
      continue;
    }

    if (Math.abs(next.left - last.right) < EPS && !last.rightInclusive && !next.leftInclusive) {
      merged.push({ ...next });
      continue;
    }

    last.right = Math.max(last.right, next.right);
    if (Math.abs(last.right - next.right) < EPS) {
      last.rightInclusive = last.rightInclusive || next.rightInclusive;
    } else if (next.right > last.right) {
      last.rightInclusive = next.rightInclusive;
    }
    if (Math.abs(last.left - next.left) < EPS) {
      last.leftInclusive = last.leftInclusive || next.leftInclusive;
    }
  }

  return merged;
}

export function parseIntervalMath(math: SetMath): ParseResult {
  try {
    let rawParts: ParsedInterval[];

    if (math.kind === "freeform") {
      rawParts = parseFreeformInput(math.freeformInput);
    } else if (math.kind === "interval") {
      const leftVal = parseBound(math.left);
      const rightVal = parseBound(math.right);
      if (leftVal > rightVal + EPS) throw new Error("Левая граница правее правой.");
      rawParts = [
        {
          left: leftVal,
          right: rightVal,
          leftInclusive: math.leftOp === "<=",
          rightInclusive: math.rightOp === "<=",
        },
      ];
    } else {
      const boundary = evaluateNumber(math.rayBoundary);
      if (math.rayOp === "<" || math.rayOp === "<=") {
        rawParts = [
          {
            left: -Infinity,
            right: boundary,
            leftInclusive: false,
            rightInclusive: math.rayOp === "<=",
          },
        ];
      } else {
        rawParts = [
          {
            left: boundary,
            right: Infinity,
            leftInclusive: math.rayOp === ">=",
            rightInclusive: false,
          },
        ];
      }
    }

    const parts = normalizeIntervals(rawParts);
    return {
      parts,
      displayText: formatSetDisplay(parts),
      latexText: formatSetLatex(parts),
      error: null,
    };
  } catch (error) {
    return {
      parts: [],
      displayText: "",
      latexText: "",
      error: (error as Error).message,
    };
  }
}

export function previewFreeformInput(input: string): { ok: boolean; text: string; error: string | null } {
  try {
    const parts = normalizeIntervals(parseFreeformInput(input));
    return { ok: true, text: formatSetDisplay(parts), error: null };
  } catch (error) {
    return { ok: false, text: "", error: (error as Error).message };
  }
}

export function valueOnMajorTick(value: number, min: number, max: number, step: number): boolean {
  if (!Number.isFinite(step) || step <= 0) return false;
  if (value < min - EPS || value > max + EPS) return false;
  const n = Math.round((value - min) / step);
  const tick = min + n * step;
  return Math.abs(tick - value) < step * 1e-6;
}

export function majorTickValues(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(step) || step <= 0 || max < min) return [];
  const values: number[] = [];
  let v = min;
  while (v <= max + EPS) {
    values.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
    v += step;
    if (values.length > 500) break;
  }
  return values;
}

export function parseSemicolonList(raw: string): number[] {
  return String(raw ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => evaluateNumber(normalizeInput(part).replace(/,/g, ".")));
}

export function suggestAxisExpand(
  value: number,
  currentMin: number,
  currentMax: number,
): { min?: number; max?: number } | null {
  if (!Number.isFinite(value)) return null;
  if (value < currentMin) return { min: value - 1 };
  if (value > currentMax) return { max: value + 1 };
  return null;
}

export function formatAxisSuggestion(min?: number, max?: number): string {
  const parts: string[] = [];
  if (min !== undefined) parts.push(`минимум → ${decimalComma(String(min))}`);
  if (max !== undefined) parts.push(`максимум → ${decimalComma(String(max))}`);
  return parts.join(", ");
}
