/**
 * Безопасный разбор математических выражений.
 *
 * Пользовательские строки НИКОГДА не исполняются как JavaScript: используется
 * AST-парсер mathjs. Поддерживается неявное умножение (3t, 2(x+1), 2sin(x)),
 * степени через ^, sqrt, тригонометрия, ln/log/exp/abs, pi.
 */
import { parse, type MathNode } from "mathjs";
import type { MathValue } from "./types";

const ALLOWED_FUNCTIONS = new Set([
  "sqrt", "cbrt", "abs", "sin", "cos", "tan", "cot", "asin", "acos", "atan",
  "sinh", "cosh", "tanh", "ln", "log", "log10", "log2", "exp", "min", "max",
  "sign", "floor", "ceil", "round", "pow", "hypot",
]);

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  Pi: Math.PI,
  PI: Math.PI,
  "π": Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
  Infinity: Infinity,
};

/** Приблизительная конвертация вставленного LaTeX в обычную запись. */
export function latexToPlain(raw: string): string {
  let s = String(raw ?? "");
  if (!/[\\{}]/.test(s)) return s;
  s = s.replace(/^\s*\$+|\$+\s*$/g, "");
  s = s.replace(/\\(?:left|right|,|;|!|quad|qquad|displaystyle|limits)/g, "");
  s = s.replace(/\\(?:begin|end)\{[^}]*\}/g, "");
  // \frac{a}{b}, \dfrac, \tfrac
  for (let i = 0; i < 8; i++) {
    const next = s.replace(
      /\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
      (_m, a, b) => `((${a})/(${b}))`,
    );
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, (_m, n, a) => `((${a})^(1/(${n})))`);
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_m, a) => `sqrt(${a})`);
  s = s.replace(/\\(?:cdot|times|ast)/g, "*");
  s = s.replace(/\\div/g, "/");
  s = s.replace(/\\pi\b/g, "pi");
  s = s.replace(/\\(?:operatorname|mathrm|text)\s*\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\(sin|cos|tan|cot|ln|log|exp|sinh|cosh|tanh|arcsin|arccos|arctan|min|max|abs)\b/g, "$1");
  s = s.replace(/\barcsin\b/g, "asin").replace(/\barccos\b/g, "acos").replace(/\barctan\b/g, "atan");
  s = s.replace(/\\le(?:q)?\b/g, "<=").replace(/\\ge(?:q)?\b/g, ">=");
  s = s.replace(/\\infty/g, "Infinity");
  s = s.replace(/\|([^|]*)\|/g, (_m, a) => `abs(${a})`);
  s = s.replace(/\^\s*\{([^{}]*)\}/g, (_m, a) => `^(${a})`);
  s = s.replace(/_\s*\{[^{}]*\}/g, "");
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\\[a-zA-Z]+/g, "");
  return s.trim();
}

/** Нормализация ввода перед разбором. */
export function normalizeInput(raw: string): string {
  let s = latexToPlain(raw);
  s = s
    .replace(/[–—−]/g, "-")
    .replace(/[·×∙]/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/∞/g, "Infinity")
    .replace(/,(?=\s*\d)/g, ".");
  return s.trim();
}

function symbolNames(node: MathNode): string[] {
  const names = new Set<string>();
  const functions = new Set<string>();
  node.traverse((child: MathNode, path: string, parent: MathNode | null) => {
    if (child.type !== "SymbolNode") return;
    const name = (child as unknown as { name: string }).name;
    if (parent && parent.type === "FunctionNode" && path === "fn") functions.add(name);
    else names.add(name);
  });
  for (const fn of functions) {
    if (!ALLOWED_FUNCTIONS.has(fn)) throw new Error(`Неизвестная функция «${fn}».`);
  }
  return Array.from(names);
}

export interface ParsedExpression {
  node: MathNode;
  normalized: string;
  latex: string;
  variables: string[];
}

/** Разбор выражения. Бросает понятную ошибку. */
export function parseExpression(raw: string, allowedVars: string[] = []): ParsedExpression {
  const normalizedInput = normalizeInput(raw);
  if (!normalizedInput) throw new Error("Выражение пустое.");
  let node: MathNode;
  try {
    node = parse(normalizedInput);
  } catch (error) {
    throw new Error(`Не удалось разобрать выражение: ${(error as Error).message}`);
  }
  const used = symbolNames(node);
  const variables: string[] = [];
  for (const name of used) {
    if (name in CONSTANTS) continue;
    if (allowedVars.includes(name)) {
      variables.push(name);
      continue;
    }
    if (ALLOWED_FUNCTIONS.has(name)) continue;
    throw new Error(
      allowedVars.length
        ? `Неизвестная переменная «${name}». Доступны: ${allowedVars.join(", ")}.`
        : `Неизвестная переменная «${name}»: здесь нужно числовое выражение.`,
    );
  }
  let latex = "";
  try {
    latex = node.toTex({ parenthesis: "auto", implicit: "hide" });
  } catch {
    latex = normalizedInput;
  }
  return { node, normalized: node.toString(), latex, variables: Array.from(new Set(variables)) };
}

const scopeBase: Record<string, unknown> = {
  pi: Math.PI,
  Pi: Math.PI,
  PI: Math.PI,
  ln: Math.log,
};

/** Компиляция выражения в быструю числовую функцию. */
export function compileExpression(
  raw: string,
  allowedVars: string[] = [],
): (scope?: Record<string, number>) => number {
  const parsed = parseExpression(raw, allowedVars);
  const compiled = parsed.node.compile();
  return (scope = {}) => {
    try {
      const result = compiled.evaluate({ ...scopeBase, ...scope });
      const value = typeof result === "number" ? result : Number(result);
      return Number.isFinite(value) ? value : NaN;
    } catch {
      return NaN;
    }
  };
}

/** Вычисление числа из выражения без переменных. */
export function evaluateNumber(raw: string): number {
  const fn = compileExpression(raw, []);
  const value = fn();
  if (!Number.isFinite(value)) {
    if (/^-?\s*Infinity$/.test(normalizeInput(raw))) return value;
    throw new Error(`«${raw}» не является числом.`);
  }
  return value;
}

const VULGAR: Record<string, string> = {
  "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾",
  "1/5": "⅕", "1/6": "⅙", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
};

function approxRational(value: number, maxDen = 24): { num: number; den: number } | null {
  for (let den = 1; den <= maxDen; den++) {
    const num = value * den;
    if (Math.abs(num - Math.round(num)) < 1e-9) return { num: Math.round(num), den };
  }
  return null;
}

function fractionText(num: number, den: number, unit = ""): string {
  if (den === 1) return unit ? (num === 1 ? unit : num === -1 ? `−${unit}` : `${num}${unit}`) : String(num);
  const sign = num < 0 ? "−" : "";
  const abs = Math.abs(num);
  if (!unit) {
    const key = `${abs}/${den}`;
    if (VULGAR[key]) return `${sign}${VULGAR[key]}`;
    return `${sign}${abs}/${den}`;
  }
  const head = abs === 1 ? unit : `${abs}${unit}`;
  return `${sign}${head}/${den}`;
}

/** Десятичная запятая: в русской математической записи точка не используется. */
export function decimalComma(text: string): string {
  return text.replace(/(\d)\.(\d)/g, "$1,$2");
}

function trimNumber(value: number): string {
  if (Object.is(value, -0)) return "0";
  const rounded = Math.abs(value) < 1e-10 ? 0 : value;
  let text = String(Number(rounded.toPrecision(12)));
  if (text.includes("e")) text = String(Number(rounded.toFixed(6)));
  return decimalComma(text.replace("-", "−"));
}


/** Человеческая математическая подпись числа. */
export function displayNumber(
  value: number,
  format: "number" | "fraction" | "pi" = "number",
): string {
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞";
  if (format === "pi") {
    const ratio = approxRational(value / Math.PI, 24);
    if (ratio) return ratio.num === 0 ? "0" : fractionText(ratio.num, ratio.den, "π");
    return trimNumber(value);
  }
  if (format === "fraction") {
    const ratio = approxRational(value, 24);
    if (ratio) return fractionText(ratio.num, ratio.den);
    return trimNumber(value);
  }
  return trimNumber(value);
}

/** Попытка узнать «точное» представление вычисленного значения. */
export function exactDisplay(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞";
  if (Math.abs(value) < 1e-12) return "0";
  const rational = approxRational(value, 12);
  if (rational) return fractionText(rational.num, rational.den);
  const piRatio = approxRational(value / Math.PI, 12);
  if (piRatio && piRatio.num !== 0) return fractionText(piRatio.num, piRatio.den, "π");
  const square = value * value;
  if (Math.abs(square - Math.round(square)) < 1e-9 && Math.round(square) > 1) {
    const sign = value < 0 ? "−" : "";
    return `${sign}√${Math.round(square)}`;
  }
  return trimNumber(Number(value.toFixed(4)));
}

/** Полное представление значения-выражения (все четыре формы). */
export function makeMathValue(raw: string, format: "number" | "fraction" | "pi" = "number"): MathValue {
  const parsed = parseExpression(raw, []);
  const value = parsed.node.compile().evaluate({ ...scopeBase }) as number;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) throw new Error(`«${raw}» не является числом.`);
  const hasSymbols = /pi|π|sqrt|\//i.test(raw);
  return {
    input: raw,
    normalized: parsed.normalized,
    value: numeric,
    display: hasSymbols ? exactDisplay(numeric) : displayNumber(numeric, format),
    latex: parsed.latex,
  };
}

/** Разбор списка значений через запятую (пробелы не важны). */
export function parseValueList(raw: string): number[] {
  return String(raw ?? "")
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => evaluateNumber(part));
}

/** Разбор границы, допускающей бесконечность. */
export function parseBound(raw: string): number {
  const s = normalizeInput(raw).toLowerCase();
  if (["-inf", "-infinity", "-∞"].includes(s)) return -Infinity;
  if (["inf", "+inf", "infinity", "+infinity", "∞", "+∞"].includes(s)) return Infinity;
  return evaluateNumber(raw);
}

/** LaTeX выражения для предпросмотра (без вычислений). */
export function expressionLatex(raw: string, allowedVars: string[]): string {
  return parseExpression(raw, allowedVars).latex;
}

/** LaTeX уравнения вида «левая = правая». */
export function equationLatex(raw: string, allowedVars: string[]): string {
  const parts = String(raw ?? "").split("=");
  if (parts.length !== 2) throw new Error("Уравнение должно содержать один знак «=».");
  const left = expressionLatex(parts[0], allowedVars);
  const right = expressionLatex(parts[1], allowedVars);
  return `${left} = ${right}`;
}

/** Функция f(x,y) = левая − правая для неявного уравнения. */
export function compileEquation(
  raw: string,
  vars: string[],
): (scope: Record<string, number>) => number {
  const parts = String(raw ?? "").split("=");
  if (parts.length !== 2) throw new Error("Уравнение должно содержать один знак «=».");
  const left = compileExpression(parts[0], vars);
  const right = compileExpression(parts[1], vars);
  return (scope) => left(scope) - right(scope);
}
