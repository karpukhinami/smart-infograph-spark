export const SECTION_ORDER: Record<string, number> = { prerequisites: 0, main: 1, additions: 2 };

export const WIDTHS = [
  { key: "oneThird", label: "1/3", fraction: 1 / 3 },
  { key: "half", label: "1/2", fraction: 1 / 2 },
  { key: "twoThirds", label: "2/3", fraction: 2 / 3 },
  { key: "full", label: "1/1", fraction: 1 },
] as const;

export const ROW_PATTERNS = [
  { ratio: "1", fractions: [1] },
  { ratio: "1:1", fractions: [1 / 2, 1 / 2] },
  { ratio: "2:1", fractions: [2 / 3, 1 / 3] },
  { ratio: "1:2", fractions: [1 / 3, 2 / 3] },
  { ratio: "1:1:1", fractions: [1 / 3, 1 / 3, 1 / 3] },
  { ratio: "2:1:1", fractions: [1 / 2, 1 / 4, 1 / 4] },
  { ratio: "1:2:1", fractions: [1 / 4, 1 / 2, 1 / 4] },
  { ratio: "1:1:2", fractions: [1 / 4, 1 / 4, 1 / 2] },
] as const;

export const PX_WIDTH_KEYS = [
  { key: "oneThird", label: "1/3", fraction: 1 / 3 },
  { key: "half", label: "1/2", fraction: 1 / 2 },
  { key: "twoThirds", label: "2/3", fraction: 2 / 3 },
  { key: "full", label: "1/1", fraction: 1 },
  { key: "quarter", label: "1/4", fraction: 1 / 4 },
] as const;

/** Card is wide enough for side addendum/formula (relaxed for manual ratios like 5/6). */
export function isWideCardFraction(fraction: number): boolean {
  return fraction > 0.5;
}
