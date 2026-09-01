/**
 * LaTeX-представления объектов сцены для интерфейса.
 * Никогда не бросает: при некорректном вводе возвращает текстовую заглушку.
 */
import { equationLatex, expressionLatex } from "./math-expr";
import type { SceneGraph } from "./types";

function textNode(raw: string): string {
  const text = String(raw ?? "").replace(/[\\{}$]/g, "");
  return `\\text{${text}}`;
}

/** LaTeX выражения; при ошибке — исходный текст. */
export function safeExpressionLatex(raw: string, variables: string[]): string {
  const text = String(raw ?? "").trim();
  if (!text) return textNode("—");
  try {
    return expressionLatex(text, variables);
  } catch {
    return textNode(text);
  }
}

function safeEquationLatex(raw: string, variables: string[]): string {
  const text = String(raw ?? "").trim();
  if (!text) return textNode("—");
  try {
    return equationLatex(text, variables);
  } catch {
    return textNode(text);
  }
}

function boundLatex(raw: string, fallback: string, variables: string[]): string {
  const text = String(raw ?? "").trim();
  if (!text) return fallback;
  return safeExpressionLatex(text, variables);
}

/** Формула графика в LaTeX (для списков выбора и заголовков). */
export function graphLatex(graph: SceneGraph, xName: string, yName: string): string {
  const math = graph.math;
  const vars = [xName, yName];
  switch (math.kind) {
    case "explicit":
      return `${textNode(yName)} = ${safeExpressionLatex(math.expression, [xName])}`;
    case "implicit":
      return safeEquationLatex(math.equation, vars);
    case "piecewise": {
      const rows = math.pieces.map((piece) => {
        const from = boundLatex(piece.from, "-\\infty", [xName]);
        const to = boundLatex(piece.to, "+\\infty", [xName]);
        const left = piece.includeFrom ? "\\leqslant" : "<";
        const right = piece.includeTo ? "\\leqslant" : "<";
        return `${safeExpressionLatex(piece.expression, [xName])} & ${textNode(
          "при",
        )}\\ ${from} ${left} ${textNode(xName)} ${right} ${to}`;
      });
      return `${textNode(yName)} = \\begin{cases}${rows.join(" \\\\ ")}\\end{cases}`;
    }
    case "qualitative":
      return `${textNode(`по ${math.anchors.length} опорным точкам`)}`;
    default:
      return textNode("функция");
  }
}

/** Короткая формула без окружений — годится для одной строки выпадающего списка. */
export function graphInlineLatex(graph: SceneGraph, xName: string, yName: string): string {
  if (graph.math.kind === "piecewise") {
    return `${textNode(yName)} = ${textNode(`кусочная функция (${graph.math.pieces.length})`)}`;
  }
  return graphLatex(graph, xName, yName);
}
