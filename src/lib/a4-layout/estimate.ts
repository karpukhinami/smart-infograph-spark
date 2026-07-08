import { PX_WIDTH_KEYS, WIDTHS, isWideCardFraction } from "@/lib/a4-layout/constants";
import {
  A4_HEADER_SIDE_PADDING_PX,
  A4_HEADER_SUMMARY_FONT_BASE,
  A4_HEADER_SUMMARY_LINE_BASE,
  A4_HEADER_TITLE_FONT_BASE,
  A4_HEADER_TITLE_LINE_BASE,
} from "@/lib/a4-layout/dom-fit";
import type { A4LayoutSettings, A4LayoutSummary, EntityHint, LayoutEntity, WidthReport } from "@/lib/a4-layout/types";
import { asArray, flattenText, stripHtmlTags, textStats } from "@/lib/a4-layout/text";

export function charsPerLine(widthPx: number, fontPx: number, avgCharEm: number): number {
  return Math.max(4, Math.floor(widthPx / (fontPx * avgCharEm)));
}

export function estimateLinesForString(text: string, cpl: number, safety: number): number {
  if (!text) return 0;
  const paras = String(text).split(/\n+/).filter(Boolean);
  let total = 0;
  for (const para of paras) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    total += Math.max(1, Math.ceil((trimmed.length / cpl) * safety));
  }
  return total;
}

export function estimateLines(value: unknown, cpl: number, safety: number, isList = false): number {
  const items = asArray(value).map((v) => flattenText(v)).filter(Boolean);
  if (items.length === 0) return 0;
  if (items.length === 1 && !Array.isArray(value)) return estimateLinesForString(items[0] as string, cpl, safety);
  const listPenalty = isList ? 0.88 : 1;
  const effectiveCpl = Math.max(4, Math.floor(cpl * listPenalty));
  return items.reduce((sum, item) => sum + estimateLinesForString(item as string, effectiveCpl, safety), 0);
}

export function contentAreaWidthPx(s: A4LayoutSettings): number {
  return s.pageWidthPx - 2 * s.outerMarginPx;
}

export function cardOuterWidthPx(fraction: number, s: A4LayoutSettings): number {
  const content = contentAreaWidthPx(s);
  if (fraction >= 1) return content;
  return Math.max(80, content * fraction - s.gapPx * (1 - fraction));
}

export function contentWidthPx(outerWidthPx: number, s: A4LayoutSettings): number {
  return Math.max(30, outerWidthPx - 2 * s.paddingXPx);
}

export function classifyFit(heightPx: number, widthKey: string, entity: LayoutEntity): WidthReport["fit"] {
  let goodMax = 125;
  let riskMax = 175;
  if (widthKey === "quarter") {
    goodMax = 80;
    riskMax = 120;
  }
  if (widthKey === "oneThird") {
    goodMax = 105;
    riskMax = 150;
  }
  if (widthKey === "half") {
    goodMax = 125;
    riskMax = 175;
  }
  if (widthKey === "twoThirds") {
    goodMax = 145;
    riskMax = 205;
  }
  if (widthKey === "full") {
    goodMax = 175;
    riskMax = 245;
  }
  if (entity.attention === "core") {
    goodMax += 45;
    riskMax += 65;
  }
  if (heightPx <= goodMax) return "good";
  if (heightPx <= riskMax) return "risky";
  return "bad";
}

export function widthKeyForFraction(fraction: number): string {
  if (fraction <= 0.26) return "quarter";
  if (fraction <= 0.38) return "oneThird";
  if (fraction <= 0.58) return "half";
  if (fraction <= 0.78) return "twoThirds";
  return "full";
}

function estimateAiAddendumBelowHeight(
  items: string[],
  layout: string,
  cpl: number,
  s: A4LayoutSettings,
): number {
  if (!items.length) return 0;
  const lineH = s.bodyLinePx * 0.95;
  const pad = 2 * s.insetPaddingYPx;
  const plain = items.map((item) => stripHtmlTags(item));

  if (layout === "row") {
    const cols = Math.min(plain.length, 3);
    const perCpl = Math.max(4, Math.floor((cpl * 0.92) / cols));
    const maxLines = Math.max(...plain.map((item) => estimateLinesForString(item, perCpl, s.safety)));
    return maxLines * lineH + pad;
  }

  if (layout === "grid") {
    const perCpl = Math.max(4, Math.floor(cpl * 0.92 * 0.5));
    const rowHeights = [plain.slice(0, 2), plain.slice(2, 4)].map((rowItems) => {
      if (!rowItems.length) return 0;
      return Math.max(...rowItems.map((item) => estimateLinesForString(item, perCpl, s.safety)));
    });
    const lines = rowHeights.reduce((sum, n) => sum + n, 0);
    return lines * lineH + pad + (rowHeights.filter(Boolean).length > 1 ? 6 : 0);
  }

  const lines = plain.reduce(
    (sum, item) => sum + estimateLinesForString(item, Math.floor(cpl * 0.92), s.safety),
    0,
  );
  return lines * lineH + pad;
}

export function estimateEntityAtFraction(entity: LayoutEntity, s: A4LayoutSettings, fraction: number): WidthReport {
  const title = entity.title ?? null;
  const bodyRaw = entity.content ?? null;
  const body = entity.contentHtml ? stripHtmlTags(flattenText(bodyRaw)) : bodyRaw;
  const formula = entity.formula ?? null;
  const addendum = entity.cardAddendum ?? null;
  const aiSpec = entity.aiAddendums;
  const aiItems = aiSpec ? asArray(aiSpec.items).map((v) => flattenText(v)).filter(Boolean) : [];
  const hasAIAddendum = aiItems.length > 0;
  const aiPlacement = aiSpec?.placement === "right" ? "right" : "below";
  const aiLayout = aiSpec?.layout || "single";
  const isList = Array.isArray(bodyRaw) && !entity.contentHtml;
  const hasFormula = textStats(formula).chars > 0;
  const addendumStats = textStats(addendum);
  const hasAddendum = !hasAIAddendum && addendumStats.chars > 0;
  const hasAddendumArray = Array.isArray(addendum);
  const widthKey = widthKeyForFraction(fraction);
  const outer = cardOuterWidthPx(fraction, s);
  const inner = contentWidthPx(outer, s);
  const cpl = charsPerLine(inner, s.bodyPx, s.avgCharEm);
  const titleCpl = charsPerLine(inner, s.bodyPx, s.avgCharEm * 1.08);
  const titleLines = title ? estimateLines(title, titleCpl, s.safety, false) : 0;
  const bodyLines = estimateLines(body, cpl, s.safety, isList);
  const formulaLines = hasFormula
    ? Math.max(asArray(formula).length, estimateLines(formula, Math.floor(cpl * 0.82), 1.05, false))
    : 0;
  const addBelowLines = hasAIAddendum
    ? 0
    : hasAddendum
      ? estimateLines(addendum, Math.floor(cpl * 0.92), s.safety, hasAddendumArray)
      : 0;
  const titleHeight = title ? Math.max(s.titlePillPx, titleLines * 12 + 16) : 0;
  const bodyHeight = bodyLines * s.bodyLinePx;
  const formulaHeight = hasFormula ? formulaLines * (s.bodyLinePx * 1.02) + 14 : 0;
  const addBelowHeight = hasAIAddendum
    ? estimateAiAddendumBelowHeight(aiItems, aiLayout, cpl, s)
    : hasAddendum
      ? addBelowLines * (s.bodyLinePx * 0.95) + 2 * s.insetPaddingYPx
      : 0;
  const verticalGaps =
    (title ? 10 : 0) +
    (bodyLines ? 6 : 0) +
    (hasFormula ? 8 : 0) +
    (hasAddendum || hasAIAddendum ? 8 : 0);
  const paddingHeight = 2 * s.paddingYPx;
  const belowHeight = titleHeight + bodyHeight + formulaHeight + addBelowHeight + verticalGaps + paddingHeight;
  let rightHeight: number | null = null;
  let rightGain: number | null = null;
  let rightStatus = "unavailable";

  if ((hasAddendum || hasAIAddendum) && isWideCardFraction(fraction)) {
    const splitGap = 8;
    const splitCandidates = fraction >= 1 ? [0.58, 0.64, 0.7, 0.76] : [0.5, 0.56, 0.62, 0.68];
    let bestRight: { height: number } | null = null;

    for (const bodyShare of splitCandidates) {
      const bodyW = Math.max(45, inner * bodyShare - splitGap / 2);
      const addW = Math.max(120, inner * (1 - bodyShare) - splitGap / 2);
      const bodyCpl = charsPerLine(bodyW, s.bodyPx, s.avgCharEm);
      const addCpl = charsPerLine(addW, s.bodyPx * 0.92, s.avgCharEm);
      const bodyLinesRight = estimateLines(body, bodyCpl, s.safety, isList);
      const formulaLinesRight = hasFormula
        ? Math.max(asArray(formula).length, estimateLines(formula, Math.floor(addCpl * 0.82), 1.05, false))
        : 0;
      const formulaHeightRight = hasFormula ? formulaLinesRight * (s.bodyLinePx * 1.02) + 14 : 0;
      const addLinesRight = hasAIAddendum
        ? 0
        : hasAddendum
          ? estimateLines(addendum, addCpl, s.safety, hasAddendumArray)
          : 0;
      const bodyRightHeight = bodyLinesRight * s.bodyLinePx;
      const addRightHeight = hasAIAddendum
        ? estimateAiAddendumBelowHeight(aiItems, aiLayout === "row" || aiLayout === "grid" ? "stack" : aiLayout, addCpl, s)
        : hasAddendum
          ? addLinesRight * (s.bodyLinePx * 0.95) + 2 * s.insetPaddingYPx
          : 0;
      const sideGap = hasFormula && (hasAddendum || hasAIAddendum) ? 8 : 0;
      const sideRightHeight = formulaHeightRight + sideGap + addRightHeight;
      const h = titleHeight + Math.max(bodyRightHeight, sideRightHeight) + verticalGaps + paddingHeight;
      if (!bestRight || h < bestRight.height) {
        bestRight = { height: h };
      }
    }

    rightHeight = bestRight!.height;
    rightGain = belowHeight === 0 ? 0 : Math.round((1 - rightHeight / belowHeight) * 100);
    rightStatus = rightGain >= 8 ? "recommended" : rightGain >= 1 ? "possible" : "avoid";
  }

  let bestPlacement = rightHeight && rightHeight < belowHeight ? "rightOfBody" : "belowBody";
  if (hasAIAddendum) {
    bestPlacement = aiPlacement === "right" ? "rightOfBody" : "belowBody";
  }
  const bestHeight =
    bestPlacement === "rightOfBody" && rightHeight != null ? rightHeight : belowHeight;
  const fit = classifyFit(bestHeight, widthKey, entity);

  return {
    key: widthKey,
    label: PX_WIDTH_KEYS.find((w) => w.key === widthKey)?.label || String(fraction),
    fraction,
    outerWidthPx: Math.round(outer),
    contentWidthPx: Math.round(inner),
    charsPerLine: cpl,
    titleLines,
    bodyLines,
    formulaLines,
    addendumBelowLines: addBelowLines,
    heightBelowPx: Math.round(belowHeight),
    heightRightPx: rightHeight == null ? null : Math.round(rightHeight),
    rightGainPercent: rightGain,
    rightStatus,
    bestPlacement,
    bestHeightPx: Math.round(bestHeight),
    fit,
  };
}

export function analyzeEntity(entity: LayoutEntity, index: number, s: A4LayoutSettings): EntityHint {
  const title = entity.title ?? null;
  const body = entity.content ?? null;
  const formula = entity.formula ?? null;
  const addendum = entity.cardAddendum ?? null;
  const titleStats = textStats(title);
  const bodyStats = textStats(body);
  const formulaStats = textStats(formula);
  const addendumStats = textStats(addendum);
  const hasFormula = formulaStats.chars > 0;
  const hasAddendum = addendumStats.chars > 0;
  const hasAddendumArray = Array.isArray(addendum);
  const widthReports = WIDTHS.map((w) => estimateEntityAtFraction(entity, s, w.fraction));
  const good = widthReports.filter((r) => r.fit === "good");
  const risky = widthReports.filter((r) => r.fit === "risky");
  const minGood = good[0] || risky[0] || widthReports[widthReports.length - 1];
  const avoid = widthReports.filter((r) => r.fit === "bad").map((r) => r.label);
  const bodyChars = bodyStats.chars;
  const maxItem = Math.max(bodyStats.maxItem, addendumStats.maxItem);
  let load = "medium";
  if (bodyChars < 85 && !hasFormula && !hasAddendum) load = "short";
  if (Array.isArray(body) && bodyStats.itemCount >= 3) load = "listHeavy";
  if (hasFormula && formulaStats.chars > 0) load = "formulaHeavy";
  if (hasAddendum && addendumStats.chars > 100) load = "addendumHeavy";
  if (bodyChars > 260 || (hasFormula && hasAddendum && bodyChars > 140)) load = "dense";
  if (maxItem > 120 && bodyChars <= 260) load = "wrapHeavy";
  if (bodyChars > 360) load = "volumeHeavy";

  let recommendedAddendumPosition: string | null = null;
  let addendumReason: string | null = null;
  if (hasAddendum) {
    const candidates = widthReports.filter((r) => r.heightRightPx != null);
    const bestRight = candidates.sort((a, b) => (b.rightGainPercent ?? -99) - (a.rightGainPercent ?? -99))[0];
    if (bestRight && bestRight.rightGainPercent! >= 8 && (bestRight.fraction >= 2 / 3 || bestRight.fraction >= 1)) {
      recommendedAddendumPosition = "rightOfBody";
      addendumReason = `справа экономит примерно ${bestRight.rightGainPercent}% высоты при ширине ${bestRight.label}`;
    } else if (hasAddendumArray && addendumStats.itemCount >= 3 && addendumStats.maxItem <= 55) {
      recommendedAddendumPosition = "belowBody";
      addendumReason = "несколько коротких элементов лучше дать horizontalGroup/grid в широкой карточке";
    } else {
      recommendedAddendumPosition = "belowBody";
      addendumReason = "расположение справа не даёт заметной экономии или ухудшает переносы";
    }
  }

  let recommendedFormulaPosition: string | null = null;
  if (hasFormula) recommendedFormulaPosition = formulaStats.chars < 70 && bodyStats.chars < 130 ? "centralZone" : "belowBody";

  const goodRatios: string[] = [];
  const minLabel = minGood.label;
  if (minLabel === "1/3") goodRatios.push("1:1:1", "1:1", "2:1", "1");
  if (minLabel === "1/2") goodRatios.push("1:1", "2:1", "1:2", "1");
  if (minLabel === "2/3") goodRatios.push("2:1", "1:2", "1");
  if (minLabel === "1/1") goodRatios.push("1");

  const avoidRatios: string[] = [];
  if (avoid.includes("1/3")) avoidRatios.push("1:1:1");
  if (avoid.includes("1/2")) avoidRatios.push("1:1");
  if (avoid.includes("2/3")) avoidRatios.push("2:1", "1:2");

  const hard: string[] = [];
  const soft: string[] = [];
  if (entity.attention === "core") hard.push('Разместить полноширинно: cardCount 1, columnRatio "1".');
  if (minLabel === "1/1") soft.push("Желательна полноширинная карточка или отдельный высокий ряд.");
  if (avoid.length) soft.push(`Избегать ширины ${avoid.join(", ")} из-за риска переполнения.`);
  if (recommendedAddendumPosition) soft.push(`cardAddendum: ${recommendedAddendumPosition}. ${addendumReason}.`);
  if (recommendedFormulaPosition) soft.push(`formula: ${recommendedFormulaPosition}.`);

  return {
    entityIndex: index,
    title: title || `Entity ${index}`,
    sectionId: entity.sectionId || "main",
    entityType: entity.entityType || "unknown",
    attention: entity.attention || "normal",
    sourceEntity: entity,
    stats: { title: titleStats, body: bodyStats, formula: formulaStats, cardAddendum: addendumStats },
    widthReports,
    atFraction: (fraction: number) => estimateEntityAtFraction(entity, s, fraction),
    contentLoad: load,
    recommendedMinWidth: minLabel,
    avoidWidths: avoid,
    goodColumnRatios: [...new Set(goodRatios)],
    avoidColumnRatios: [...new Set(avoidRatios)],
    addendumHint: hasAddendum
      ? {
          exists: true,
          recommendedPosition: recommendedAddendumPosition,
          reason: addendumReason,
          allowedPositions: recommendedAddendumPosition === "rightOfBody" ? ["belowBody", "rightOfBody"] : ["belowBody"],
          suggestedContainerLayout:
            hasAddendumArray && addendumStats.itemCount >= 3 && addendumStats.maxItem <= 55
              ? "horizontalGroup or grid"
              : "single or verticalStack",
        }
      : { exists: false },
    formulaHint: hasFormula
      ? { exists: true, recommendedPosition: recommendedFormulaPosition, suggestedEmphasis: load === "formulaHeavy" ? "strong" : "normal" }
      : { exists: false },
    hardConstraints: hard,
    softHints: soft,
  };
}

export function estimateHeaderMetrics(summary: A4LayoutSummary, _s: A4LayoutSettings) {
  const titleFontPx = A4_HEADER_TITLE_FONT_BASE;
  const titleLinePx = A4_HEADER_TITLE_LINE_BASE;
  const summaryFontPx = A4_HEADER_SUMMARY_FONT_BASE;
  const summaryLinePx = A4_HEADER_SUMMARY_LINE_BASE;
  const sidePaddingPx = A4_HEADER_SIDE_PADDING_PX;
  const topPaddingPx = 12;
  const bottomPaddingPx = 16;
  const hasMeta = Boolean(summary.subject || summary.grade);
  const metaHeightPx = hasMeta ? 22 : 0;
  const metaGapPx = hasMeta ? 6 : 0;

  const titleText = String(summary.topic || "");
  const summaryText = String(summary.summary || "");
  const usableWidth = 565 - sidePaddingPx * 2;
  const titleCharsPerLine = Math.max(8, Math.floor(usableWidth / (titleFontPx * 0.52)));
  const summaryCharsPerLine = Math.max(8, Math.floor(usableWidth / (summaryFontPx * 0.52)));
  const titleLines = Math.max(1, Math.ceil(titleText.length / titleCharsPerLine));
  const summaryLines = summaryText ? Math.max(1, Math.ceil(summaryText.length / summaryCharsPerLine)) : 0;

  const height = Math.round(
    topPaddingPx +
      metaHeightPx +
      metaGapPx +
      titleLines * titleLinePx +
      (summaryLines ? 4 + summaryLines * summaryLinePx : 0) +
      bottomPaddingPx,
  );

  return {
    height,
    width: 565,
    borderRadius: 15,
    sidePaddingPx,
    topPaddingPx,
    bottomPaddingPx,
    title: { fontSizePx: titleFontPx, lineHeightPx: titleLinePx, weight: 700, lines: titleLines },
    summary: { fontSizePx: summaryFontPx, lineHeightPx: summaryLinePx, weight: 500, lines: summaryLines },
    meta: { exists: hasMeta, fontSizePx: 12, lineHeightPx: 14, radiusPx: 14 },
  };
}

export function estimateHeaderHeight(summary: A4LayoutSummary, s: A4LayoutSettings): number {
  return estimateHeaderMetrics(summary, s).height;
}

export function metaText(summary: A4LayoutSummary): string {
  return [summary.subject, summary.grade].filter(Boolean).join(" • ");
}
