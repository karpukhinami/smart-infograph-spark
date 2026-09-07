/** Извлечение четырёх буквенных обозначений вершин нижнего основания. */

const LETTER = /[A-Za-zА-Яа-яЁё]/;

export function parseBaseVertexLabels(input: string): string[] | null {
  const letters: string[] = [];
  for (const char of String(input ?? "")) {
    if (LETTER.test(char)) {
      letters.push(char.toUpperCase());
      if (letters.length === 4) break;
    }
  }
  if (letters.length < 4) return null;
  const unique = new Set(letters);
  if (unique.size < 4) return null;
  return letters;
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
