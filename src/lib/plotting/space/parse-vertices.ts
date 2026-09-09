/** Извлечение буквенных обозначений вершин. */

const LETTER = /[A-Za-zА-Яа-яЁё]/;

function extractLetters(input: string, max?: number): string[] {
  const letters: string[] = [];
  for (const char of String(input ?? "")) {
    if (LETTER.test(char)) {
      letters.push(char.toUpperCase());
      if (max !== undefined && letters.length >= max) break;
    }
  }
  return letters;
}

/** Четыре буквы нижнего основания параллелепипеда. */
export function parseBaseVertexLabels(input: string): string[] | null {
  const letters = extractLetters(input, 4);
  if (letters.length < 4) return null;
  if (new Set(letters).size < 4) return null;
  return letters;
}

/** Пирамида: первая буква — вершина, остальные — основание (минимум 3). */
export function parsePyramidVertexLabels(input: string): { apex: string; base: string[] } | null {
  const letters = extractLetters(input);
  if (letters.length < 4) return null;
  if (new Set(letters).size < letters.length) return null;
  return { apex: letters[0]!, base: letters.slice(1) };
}

export function formatVertexLabel(base: string, subscript?: number): string {
  if (!subscript) return base;
  const subs = "₀₁₂₃₄₅₆₇₈₉";
  const digits = String(subscript)
    .split("")
    .map((d) => subs[Number(d)] ?? d)
    .join("");
  return `${base}${digits}`;
}
