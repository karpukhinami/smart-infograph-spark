import { ROW_PATTERNS, SECTION_ORDER } from "@/lib/a4-layout/constants";
import type { A4LayoutSettings, EntityHint, LayoutPlan, LayoutRow, RowCostResult } from "@/lib/a4-layout/types";

type RowCostOptions = { ignoreCore?: boolean; preferTrio?: boolean; discourageTrio?: boolean };

export function rowCost(
  cards: EntityHint[],
  pattern: { ratio: string; fractions: readonly number[] },
  s: A4LayoutSettings,
  options: RowCostOptions = {},
): RowCostResult | null {
  if (cards.length !== pattern.fractions.length) return null;
  if (!options.ignoreCore && cards.some((c) => c.attention === "core") && (cards.length !== 1 || pattern.ratio !== "1")) return null;

  const reports = cards.map((c, i) => c.atFraction(pattern.fractions[i]));
  const heights = reports.map((r) => r.bestHeightPx);
  const rowHeight = Math.max(...heights);
  const empty = heights.reduce((sum, h) => sum + Math.max(0, rowHeight - h), 0);
  const emptyRatio = empty / Math.max(1, rowHeight * cards.length);

  const overflowRisk = reports.reduce((sum, r) => sum + (r.fit === "bad" ? 260 : r.fit === "risky" ? 70 : 0), 0);
  const narrowPenalty = reports.reduce((sum, r) => sum + (r.key === "quarter" && r.fit !== "good" ? 260 : 0), 0);
  const minWidthPenalty = reports.reduce((sum, r, i) => {
    const min = cards[i].recommendedMinWidth;
    const order: Record<string, number> = { "1/3": 1, "1/2": 2, "2/3": 3, "1/1": 4 };
    return sum + ((order[r.label] || 0) < (order[min] || 0) ? 95 : 0);
  }, 0);

  const sections = cards.map((c) => SECTION_ORDER[c.sectionId] ?? 1);
  const mixedSections = new Set(sections).size > 1;
  const sectionBackwards = sections.some((v, i) => i > 0 && v < sections[i - 1]);
  const mixedPenalty = mixedSections ? 28 : 0;
  const sectionPenalty = sectionBackwards ? 9999 : mixedPenalty;

  let countBonus = cards.length === 2 ? -35 : cards.length === 3 ? -16 : 0;
  if (options.preferTrio) countBonus += cards.length === 3 ? -55 : 0;
  if (options.discourageTrio) countBonus += cards.length === 3 ? 45 : 0;

  let modePenalty = 0;
  if (s.optimizerMode === "compact") modePenalty = cards.length === 1 ? 20 : cards.length === 3 ? -18 : -10;
  if (s.optimizerMode === "airy") modePenalty = cards.length === 3 ? 35 : cards.length === 2 ? 5 : 0;

  const visualBalancePenalty = emptyRatio > 0.55 ? 110 : emptyRatio > 0.4 ? 60 : emptyRatio > 0.28 ? 24 : 0;

  const wrapPenalty = cards.reduce((sum, c, i) => {
    const r = reports[i];
    if ((c.contentLoad === "wrapHeavy" || c.contentLoad === "volumeHeavy" || c.contentLoad === "dense") && (r.key === "oneThird" || r.key === "quarter")) return sum + 120;
    return sum;
  }, 0);

  const cost = rowHeight + empty * 0.26 + overflowRisk + narrowPenalty + minWidthPenalty + sectionPenalty + visualBalancePenalty + wrapPenalty + countBonus + modePenalty;
  return {
    pattern: pattern.ratio,
    fractions: [...pattern.fractions],
    reports,
    heights,
    rowHeight: Math.round(rowHeight),
    emptyPx: Math.round(empty),
    emptyRatio: Math.round(emptyRatio * 100),
    mixedSections,
    cost: Math.round(cost),
  };
}

function candidatePatternsForCount(n: number) {
  return ROW_PATTERNS.filter((p) => p.fractions.length === n);
}

function singleFullRowCost(card: EntityHint, s: A4LayoutSettings) {
  return rowCost([card], ROW_PATTERNS.find((p) => p.ratio === "1")!, s)!;
}

function candidateSortValue(candidate: RowCostResult) {
  return candidate.rowHeight * 10000 + candidate.emptyRatio * 100 + candidate.cost;
}

function bestRowForCards(cards: EntityHint[], s: A4LayoutSettings, options: RowCostOptions = {}) {
  const candidates = candidatePatternsForCount(cards.length)
    .map((p) => rowCost(cards, p, s, options))
    .filter((c): c is RowCostResult => Boolean(c))
    .sort((a, b) => candidateSortValue(a) - candidateSortValue(b));
  return candidates[0] || null;
}

function stackedCost(rows: (RowCostResult | null)[], s: A4LayoutSettings) {
  return rows.reduce((sum, r) => sum + (r ? r.cost : 9999), 0) + Math.max(0, rows.length - 1) * s.gapPx;
}

function sameSection(cards: EntityHint[]) {
  return new Set(cards.map((c) => c.sectionId)).size === 1;
}

function sameEntityType(cards: EntityHint[]) {
  return new Set(cards.map((c) => c.entityType)).size === 1;
}

function sameSemanticOrder(cards: EntityHint[]) {
  if (!cards || cards.length < 2) return false;
  return sameSection(cards) && sameEntityType(cards);
}

function sameTypeRunLength(cards: EntityHint[], startIndex: number) {
  const first = cards[startIndex];
  if (!first) return 0;
  let len = 1;
  for (let j = startIndex + 1; j < cards.length; j++) {
    const cur = cards[j];
    if (cur.sectionId !== first.sectionId || cur.entityType !== first.entityType || cur.attention === "core") break;
    len++;
  }
  return len;
}

function previousSameTypeRunLength(cards: EntityHint[], index: number) {
  const cur = cards[index];
  if (!cur) return 0;
  let len = 1;
  for (let j = index - 1; j >= 0; j--) {
    const prev = cards[j];
    if (prev.sectionId !== cur.sectionId || prev.entityType !== cur.entityType || prev.attention === "core") break;
    len++;
  }
  return len;
}

function sectionOrderIndex(sectionId: string) {
  const order: Record<string, number> = { prerequisites: 0, main: 1, additions: 2 };
  return Object.prototype.hasOwnProperty.call(order, sectionId) ? order[sectionId] : 99;
}

function preservesSectionOrder(cards: EntityHint[]) {
  for (let i = 1; i < cards.length; i++) {
    if (sectionOrderIndex(cards[i].sectionId) < sectionOrderIndex(cards[i - 1].sectionId)) return false;
  }
  return true;
}

function isAlgorithmOrClassificationSequence(cards: EntityHint[], previousCore: EntityHint | null) {
  const types = cards.map((c) => c.entityType);
  const stepLike = types.every((t) => t === "algorithmStep" || t === "classificationItem");
  if (!stepLike) return false;

  if (previousCore) {
    const coreType = previousCore.entityType;
    if (coreType === "algorithmHeader" && types.every((t) => t === "algorithmStep")) return true;
    if (coreType === "classificationBasis" && types.every((t) => t === "classificationItem")) return true;
  }

  if (sameSection(cards) && stepLike) return true;
  return cards.length >= 3 && sameSemanticOrder(cards);
}

function preserveOriginalOrder(hints: EntityHint[]) {
  return [...hints].sort((a, b) => a.entityIndex - b.entityIndex);
}

function splitByCoreAndSection(hints: EntityHint[]) {
  const ordered = preserveOriginalOrder(hints);
  const groups: { type: "core" | "regular"; cards: EntityHint[] }[] = [];
  let current: EntityHint[] = [];

  for (const h of ordered) {
    if (h.attention === "core") {
      if (current.length) {
        groups.push({ type: "regular", cards: current });
        current = [];
      }
      groups.push({ type: "core", cards: [h] });
    } else {
      current.push(h);
    }
  }

  if (current.length) groups.push({ type: "regular", cards: current });
  return groups;
}

function allRowCandidates(cards: EntityHint[], s: A4LayoutSettings, options: RowCostOptions = {}) {
  return candidatePatternsForCount(cards.length)
    .map((p) => rowCost(cards, p, s, options))
    .filter((c): c is RowCostResult => Boolean(c))
    .sort((a, b) => candidateSortValue(a) - candidateSortValue(b));
}

function chooseRowsForRegularGroup(cards: EntityHint[], s: A4LayoutSettings, previousCore: EntityHint | null = null) {
  const rows: LayoutRow[] = [];
  const decisions: unknown[] = [];
  const trace: unknown[] = [];
  let i = 0;

  while (i < cards.length) {
    const k1 = cards[i];
    const single1 = singleFullRowCost(k1, s);

    const currentRun = sameTypeRunLength(cards, i);
    const nextRun = i + 1 < cards.length ? sameTypeRunLength(cards, i + 1) : 0;
    if (currentRun === 1 && nextRun >= 2) {
      rows.push({ cards: [k1], ...single1, decision: "singleton before semantic run: full-width" });
      decisions.push({
        entityIndexes: [k1.entityIndex],
        decision: "singleBeforeSemanticRun",
        reason: `Следующие ${nextRun} карточки имеют один entityType и sectionId; текущая карточка не смешивается с ними, чтобы сохранить однородную группу.`,
      });
      trace.push({
        stepIndex: i,
        type: "semantic-run-lookahead",
        cards: [k1.entityIndex],
        nextRun: cards.slice(i + 1, i + 1 + nextRun).map((c) => ({ entityIndex: c.entityIndex, entityType: c.entityType, sectionId: c.sectionId })),
        reason: `K${i + 2} начинает серию из ${nextRun} карточек одного порядка; K${i + 1} оставлена отдельно.`,
      });
      i += 1;
      continue;
    }

    if (i + 1 >= cards.length) {
      rows.push({ cards: [k1], ...single1, decision: "single remaining card: full-width" });
      decisions.push({ entityIndexes: [k1.entityIndex], decision: "singleFullWidth", reason: "Осталась одна карточка в группе; она ставится полноширинно." });
      trace.push({ stepIndex: i, type: "single", cards: [k1.entityIndex], reason: "Осталась одна карточка." });
      i += 1;
      continue;
    }

    if (i + 2 < cards.length) {
      const lookK2 = cards[i + 1];
      const lookK3 = cards[i + 2];
      const k2k3Ordered = preservesSectionOrder([lookK2, lookK3]);
      const k2k3Tail = previousSameTypeRunLength(cards, i + 1) >= 2;
      const k2k3Same = sameSemanticOrder([lookK2, lookK3]);
      if (k2k3Ordered && (k2k3Tail || k2k3Same)) {
        const k2Full = singleFullRowCost(lookK2, s);
        const k3Full = singleFullRowCost(lookK3, s);
        const k2k3VerticalHeight = k2Full.rowHeight + s.gapPx + k3Full.rowHeight;
        const k2k3Best = allRowCandidates([lookK2, lookK3], s)[0] || null;
        const k2k3Gain = k2k3Best ? k2k3VerticalHeight - k2k3Best.rowHeight : 0;
        const currentRunAllowsSkip = sameTypeRunLength(cards, i) === 1 || previousSameTypeRunLength(cards, i) >= 2;

        if (currentRunAllowsSkip && k2k3Best && k2k3Gain >= Math.max(28, s.gapPx * 2.5)) {
          rows.push({ cards: [k1], ...single1, decision: "lookahead protects next pair: full-width" });
          decisions.push({
            entityIndexes: [k1.entityIndex],
            decision: "leaveCurrentForNextPair",
            reason: `Следующая пара ${lookK2.entityIndex}+${lookK3.entityIndex} экономит ${Math.round(k2k3Gain)}px по высоте; текущая карточка оставлена отдельно.`,
          });
          trace.push({
            stepIndex: i,
            type: "next-pair-lookahead",
            cards: [k1.entityIndex],
            nextPairGain: Math.round(k2k3Gain),
            reason: `K${i + 2}+K${i + 3} выгоднее держать вместе; K${i + 1} не забирает первую карточку пары.`,
          });
          i += 1;
          continue;
        }
      }
    }

    const k2 = cards[i + 1];
    const single2 = singleFullRowCost(k2, s);
    const stacked12Cost = stackedCost([single1, single2], s);
    const stacked12Height = single1.rowHeight + s.gapPx + single2.rowHeight;
    const pairCandidates = allRowCandidates([k1, k2], s);
    const bestPair = pairCandidates[0] || null;
    const sameOrderPair = sameSemanticOrder([k1, k2]);
    const orderedMixedPair = !sameOrderPair && preservesSectionOrder([k1, k2]);
    const k1IsTailOfSemanticRun = previousSameTypeRunLength(cards, i) >= 2;
    const pairThresholdMultiplier = sameOrderPair ? 1.08 : orderedMixedPair && k1IsTailOfSemanticRun ? 1.1 : orderedMixedPair ? 1.06 : 1.02;
    const pairHeightThreshold = stacked12Height * pairThresholdMultiplier;
    const pairHeightGain = stacked12Height - (bestPair ? bestPair.rowHeight : Infinity);
    const pairWins = Boolean(bestPair && (bestPair.rowHeight <= pairHeightThreshold || (orderedMixedPair && pairHeightGain >= s.gapPx * 2)));

    trace.push({
      stepIndex: i,
      type: "pair-check",
      cards: [k1.entityIndex, k2.entityIndex],
      pairWins,
      decision: pairWins ? "try-pair-and-maybe-trio" : "separate-first",
    });

    if (!pairWins) {
      rows.push({ cards: [k1], ...single1, decision: "pair loses: K1 full-width, compare K2 with next" });
      decisions.push({
        entityIndexes: [k1.entityIndex, k2.entityIndex],
        decision: "separateFirst",
        reason: "Две карточки рядом не выигрывают у вертикального размещения; первая карточка фиксируется полноширинной, вторая сравнивается со следующей.",
      });
      i += 1;
      continue;
    }

    if (i + 2 < cards.length) {
      const k3 = cards[i + 2];
      const trioCards = [k1, k2, k3];
      const preferTrio = isAlgorithmOrClassificationSequence(trioCards, previousCore) || sameSemanticOrder(trioCards);
      const trioCandidates = allRowCandidates(trioCards, s, { preferTrio, discourageTrio: !preferTrio });
      const bestTrio = trioCandidates[0] || null;
      const single3 = singleFullRowCost(k3, s);
      const pairPlusThirdHeight = bestPair!.rowHeight + s.gapPx + single3.rowHeight;
      const trioThresholdMultiplier = preferTrio ? 1.08 : 0.96;
      const trioThreshold = pairPlusThirdHeight * trioThresholdMultiplier;
      const trioWins = Boolean(bestTrio && bestTrio.rowHeight <= trioThreshold);

      trace.push({ stepIndex: i, type: "trio-check", cards: trioCards.map((c) => c.entityIndex), trioWins });

      if (trioWins) {
        rows.push({ cards: trioCards, ...bestTrio!, decision: preferTrio ? "semantic trio wins" : "trio wins by compactness" });
        decisions.push({
          entityIndexes: trioCards.map((c) => c.entityIndex),
          decision: "threeInRow",
          pattern: bestTrio!.pattern,
          semanticPriority: preferTrio,
        });
        i += 3;
        continue;
      }
    }

    rows.push({ cards: [k1, k2], ...bestPair!, decision: "pair wins" });
    decisions.push({
      entityIndexes: [k1.entityIndex, k2.entityIndex],
      decision: "twoInRow",
      pattern: bestPair!.pattern,
      reason: "Две карточки рядом выигрывают или сопоставимы с вертикальным размещением; приоритет отдан парному ряду.",
    });
    i += 2;
  }

  return { rows, decisions, trace };
}

function rebalanceLonelyFinalRow(rows: LayoutRow[], s: A4LayoutSettings) {
  if (rows.length < 2) return;
  const last = rows[rows.length - 1];
  if (!last || last.cards.length !== 1 || last.pattern !== "1") return;
  const lonely = last.cards[0];
  const report = last.reports && last.reports[0];
  if (!report || report.bestHeightPx > 80) return;

  const prev = rows[rows.length - 2];
  if (!prev || prev.cards.length < 2) return;
  const candidateIndex = prev.cards.length - 1;
  const candidate = prev.cards[candidateIndex];

  const protectedTypes = new Set(["algorithmStep", "classificationItem", "actionList"]);
  if (protectedTypes.has(candidate.entityType) && protectedTypes.has(lonely.entityType)) return;
  if (candidate.sectionId !== lonely.sectionId && candidate.entityType !== lonely.entityType) return;

  const newPair = [candidate, lonely];
  const pair = bestRowForCards(newPair, s);
  if (!pair) return;
  const oldHeight = prev.rowHeight + s.gapPx + last.rowHeight;
  const newHeight = Math.max(prev.rowHeight, pair.rowHeight) + s.gapPx;
  if (newHeight > oldHeight) return;

  prev.cards.splice(candidateIndex, 1);
  prev.fractions.splice(candidateIndex, 1);
  prev.reports.splice(candidateIndex, 1);
  prev.heights.splice(candidateIndex, 1);
  last.cards = [candidate, lonely];
  Object.assign(last, pair);
  last.decision = "paired short final card with previous row";
}

function buildAlternatives(ordered: EntityHint[], s: A4LayoutSettings) {
  const alt: unknown[] = [];

  for (let i = 0; i < ordered.length - 1; i++) {
    const pair = ordered.slice(i, i + 2);
    if (pair.some((c) => c.attention === "core")) continue;

    const singleA = singleFullRowCost(pair[0], s);
    const singleB = singleFullRowCost(pair[1], s);
    const stacked = stackedCost([singleA, singleB], s);
    const patterns = candidatePatternsForCount(2)
      .map((p) => rowCost(pair, p, s))
      .filter((c): c is RowCostResult => Boolean(c))
      .sort((a, b) => candidateSortValue(a) - candidateSortValue(b));
    if (patterns.length) {
      alt.push({
        entityIndexes: pair.map((c) => c.entityIndex),
        titles: pair.map((c) => c.title),
        best: patterns[0].pattern,
        comparedTo: "1 + 1",
        gainPx: Math.round(stacked - patterns[0].cost),
        note: patterns[0].cost <= stacked ? "pair better/equal" : "stack better",
      });
    }
  }

  for (let i = 0; i < ordered.length - 2; i++) {
    const trio = ordered.slice(i, i + 3);
    if (trio.some((c) => c.attention === "core")) continue;

    const bestTrio = candidatePatternsForCount(3)
      .map((p) => rowCost(trio, p, s))
      .filter((c): c is RowCostResult => Boolean(c))
      .sort((a, b) => candidateSortValue(a) - candidateSortValue(b))[0];
    const bestPair = bestRowForCards(trio.slice(0, 2), s);
    const single3 = singleFullRowCost(trio[2], s);
    if (bestTrio && bestPair && single3) {
      const pairPlus = stackedCost([bestPair, single3], s);
      alt.push({
        entityIndexes: trio.map((c) => c.entityIndex),
        titles: trio.map((c) => c.title),
        best: bestTrio.pattern,
        comparedTo: `${bestPair.pattern} + 1`,
        gainPx: Math.round(pairPlus - bestTrio.cost),
        note: "trio comparison",
      });
    }
  }

  return (alt as { gainPx?: number }[]).sort((a, b) => (b.gainPx || 0) - (a.gainPx || 0)).slice(0, 10);
}

export function optimizeRows(hints: EntityHint[], s: A4LayoutSettings): LayoutPlan {
  const groups = splitByCoreAndSection(hints);
  const rows: LayoutRow[] = [];
  const decisions: unknown[] = [];
  const trace: unknown[] = [];
  let previousCore: EntityHint | null = null;

  for (const group of groups) {
    if (group.type === "core") {
      const card = group.cards[0];
      const full = singleFullRowCost(card, s);
      rows.push({ cards: [card], ...full, decision: "core full-width" });
      decisions.push({
        entityIndexes: [card.entityIndex],
        decision: "coreFullWidth",
        pattern: "1",
        reason: 'attention="core" всегда ставится полноширинно независимо от расчётов.',
      });
      trace.push({ type: "core", cards: [card.entityIndex], reason: 'attention="core" всегда полноширинный.' });
      previousCore = card;
    } else {
      const planned = chooseRowsForRegularGroup(group.cards, s, previousCore);
      rows.push(...planned.rows);
      decisions.push(...planned.decisions);
      trace.push(...planned.trace);
    }
  }

  const availableHeight = s.pageHeightPx - 2 * s.outerMarginPx;
  const totalRowsHeight = rows.reduce((sum, r) => sum + r.rowHeight, 0) + Math.max(0, rows.length - 1) * s.gapPx;
  const fitRatio = totalRowsHeight / availableHeight;
  const verdict = fitRatio <= 0.78 ? "spacious" : fitRatio <= 0.95 ? "good" : fitRatio <= 1.08 ? "tight" : "overflowRisk";
  const alternatives = buildAlternatives(preserveOriginalOrder(hints), s);
  rebalanceLonelyFinalRow(rows, s);

  return {
    orderedEntityIndexes: rows.flatMap((r) => r.cards.map((c) => c.entityIndex)),
    rows,
    score: rows.reduce((sum, r) => sum + r.cost, 0),
    totalRowsHeight: Math.round(totalRowsHeight),
    availableHeight: Math.round(availableHeight),
    fitRatio: Math.round(fitRatio * 100),
    verdict,
    alternatives,
    decisions,
    trace,
  };
}
