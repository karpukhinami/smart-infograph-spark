import type { A4LayoutSettings, EntityHint, LayoutPlan, LayoutRow } from "@/lib/a4-layout/types";

export interface ParsedManualPattern {
  ratio: string;
  fractions: number[];
}

export function parseManualRatios(text: string): { patterns: ParsedManualPattern[]; errors: string[] } {
  const lines = String(text || "")
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const parsed: ParsedManualPattern[] = [];
  const errors: string[] = [];

  lines.forEach((line, idx) => {
    const nums = line.replace(/\s+/g, "").split(":").map(Number);
    if (!nums.length || nums.some((n) => !Number.isFinite(n) || n <= 0)) {
      errors.push(`Строка ${idx + 1}: «${line}» не является корректным ratio.`);
      return;
    }
    const sum = nums.reduce((a, b) => a + b, 0);
    parsed.push({
      ratio: line.replace(/\s+/g, ""),
      fractions: nums.map((n) => n / sum),
    });
  });

  return { patterns: parsed, errors };
}

function preserveOriginalOrder(hints: EntityHint[]): EntityHint[] {
  return [...hints].sort((a, b) => a.entityIndex - b.entityIndex);
}

/**
 * Builds a layout plan from user-supplied row ratios.
 * Cards are taken in JSON order; widths/heights use the same estimators as auto layout.
 */
export function buildManualLayoutPlan(
  hints: EntityHint[],
  settings: A4LayoutSettings,
  manualRatiosText: string,
): { plan: LayoutPlan; errors: string[] } {
  const ordered = preserveOriginalOrder(hints);
  const parsed = parseManualRatios(manualRatiosText);
  const errors = [...parsed.errors];
  const rows: LayoutRow[] = [];
  let cursor = 0;

  const expectedCards = parsed.patterns.reduce((sum, p) => sum + p.fractions.length, 0);
  if (expectedCards !== ordered.length) {
    errors.push(`В шаблоне ${expectedCards} карточек, в JSON — ${ordered.length}.`);
  }

  for (let i = 0; i < parsed.patterns.length; i++) {
    const pattern = parsed.patterns[i];
    const count = pattern.fractions.length;
    const cards = ordered.slice(cursor, cursor + count);

    if (cards.length < count) {
      errors.push(`Строка ${i + 1}: для ratio ${pattern.ratio} нужно ${count} карточек, осталось ${cards.length}.`);
      break;
    }

    const reports = cards.map((card, j) => card.atFraction(pattern.fractions[j]));
    const heights = reports.map((r) => r.bestHeightPx);
    const rowHeight = Math.max(...heights);
    const empty = heights.reduce((sum, h) => sum + Math.max(0, rowHeight - h), 0);
    const emptyRatio = Math.round((empty / Math.max(1, rowHeight * cards.length)) * 100);

    rows.push({
      cards,
      pattern: pattern.ratio,
      fractions: [...pattern.fractions],
      reports,
      heights,
      rowHeight: Math.round(rowHeight),
      emptyPx: Math.round(empty),
      emptyRatio,
      mixedSections: new Set(cards.map((c) => c.sectionId)).size > 1,
      cost: Math.round(rowHeight),
      decision: "manual ratio",
    });

    cursor += count;
  }

  if (cursor < ordered.length) {
    const left = ordered
      .slice(cursor)
      .map((c) => c.entityIndex)
      .join(", ");
    errors.push(`Не все карточки размещены. Остались entity indexes: ${left}. Добавьте ещё строки ratio.`);
  }

  const availableHeight = settings.pageHeightPx - 2 * settings.outerMarginPx;
  const totalRowsHeight = rows.reduce((sum, r) => sum + r.rowHeight, 0) + Math.max(0, rows.length - 1) * settings.gapPx;
  const fitRatio = rows.length ? totalRowsHeight / availableHeight : 0;
  const verdict = errors.length
    ? "manualError"
    : fitRatio <= 0.78
      ? "spacious"
      : fitRatio <= 0.95
        ? "good"
        : fitRatio <= 1.08
          ? "tight"
          : "overflowRisk";

  return {
    plan: {
      orderedEntityIndexes: rows.flatMap((r) => r.cards.map((c) => c.entityIndex)),
      rows,
      score: rows.reduce((sum, r) => sum + r.cost, 0),
      totalRowsHeight: Math.round(totalRowsHeight),
      availableHeight: Math.round(availableHeight),
      fitRatio: Math.round(fitRatio * 100),
      verdict,
      alternatives: [],
      decisions: [],
      trace: [],
      manual: true,
      manualErrors: errors,
    },
    errors,
  };
}
