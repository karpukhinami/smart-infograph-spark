/**
 * Нормализация обозначений вершин: кириллица → латиница по раскладке клавиатуры,
 * разрешение коллизий (A–Z, затем буква с индексом).
 */
import { formatVertexLabel } from "./parse-vertices";

/** Кириллица (ЙЦУКЕН) → латинская буква на той же клавишной клавише. */
const CYRILLIC_TO_LATIN_KEY: Record<string, string> = {
  й: "q",
  ц: "w",
  у: "e",
  к: "r",
  е: "t",
  н: "y",
  г: "u",
  ш: "i",
  щ: "o",
  з: "p",
  х: "[",
  ъ: "]",
  ф: "a",
  ы: "s",
  в: "d",
  а: "f",
  п: "g",
  р: "h",
  о: "j",
  л: "k",
  д: "l",
  ж: ";",
  э: "'",
  я: "z",
  ч: "x",
  с: "c",
  м: "v",
  и: "b",
  т: "n",
  ь: "m",
  б: ",",
  ю: ".",
  ё: "`",
};

/** Одна буква → латинская A–Z по клавише; латиница — как есть. */
export function latinKeyFromLetterChar(char: string): string | null {
  if (!char) return null;
  if (/^[A-Za-z]$/.test(char)) return char.toUpperCase();
  const mapped = CYRILLIC_TO_LATIN_KEY[char.toLowerCase()];
  if (!mapped) return null;
  const letter = mapped.toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : null;
}

export function nextAvailableVertexLabel(used: Set<string>): string {
  for (let c = 65; c <= 90; c += 1) {
    const ch = String.fromCharCode(c);
    if (!used.has(ch)) return ch;
  }
  for (let sub = 1; sub < 100; sub += 1) {
    for (let c = 65; c <= 90; c += 1) {
      const ch = String.fromCharCode(c);
      const label = formatVertexLabel(ch, sub);
      if (!used.has(label)) return label;
    }
  }
  return formatVertexLabel("Z", 99);
}

/** Уникальные латинские обозначения в порядке ввода. */
export function assignUniqueVertexLabels(rawLetters: string[]): string[] {
  const used = new Set<string>();
  const out: string[] = [];
  for (const raw of rawLetters) {
    let label = latinKeyFromLetterChar(raw);
    if (!label) label = nextAvailableVertexLabel(used);
    if (used.has(label)) label = nextAvailableVertexLabel(used);
    used.add(label);
    out.push(label);
  }
  return out;
}

/**
 * Подпись пользовательской точки: первая буква по раскладке, суффикс сохраняется;
 * при коллизии — первая свободная буква (или с индексом).
 */
export function normalizeUserPointLabel(raw: string, used: Set<string>): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const chars = [...trimmed];
  const first = chars[0]!;
  const suffix = trimmed.slice(first.length);
  let base = latinKeyFromLetterChar(first);
  if (!base) base = nextAvailableVertexLabel(used);
  let candidate = base + suffix;
  if (used.has(candidate)) {
    base = nextAvailableVertexLabel(used);
    candidate = base + suffix;
    if (used.has(candidate)) candidate = nextAvailableVertexLabel(used);
  }
  return candidate;
}
