import type { A4RowTargets, A4DomFitOptions } from "@/lib/a4-layout/types";
import { A4_DOM_FIT_EXPORT_OPTIONS, A4_DOM_FIT_SCREEN_OPTIONS, DEFAULT_A4_DOM_FIT_OPTIONS } from "@/lib/a4-layout/types";

interface FitState {
  titleFont: number;
  bodyFont: number;
  addFont: number;
  titlePadY: number;
  titlePadX: number;
  addPadY: number;
  addPadX: number;
  gapTitleBody: number;
  gapBodyAdd: number;
  gapAddItems: number;
  cardPadY: number;
  cardPadX: number;
}

interface CardMeasure {
  scrollHeight: number;
  clientHeight: number;
  overflow: boolean;
  free: number;
}

export const A4_HEADER_TITLE_FONT_BASE = 26.07 * 1.2;
export const A4_HEADER_SUMMARY_FONT_BASE = 14;
export const A4_HEADER_TITLE_LINE_BASE = 33 * 1.2;
export const A4_HEADER_SUMMARY_LINE_BASE = 18;
export const A4_HEADER_SIDE_PADDING_PX = 40;
export const A4_HEADER_META_INSET_PX = 12;

/** Safety ceiling only — normal fitting stops on overflow long before this. */
const A4_FIT_GROW_CEILING = 96;

const A4_FIT_MIN = {
  titleFont: 6,
  bodyFont: 6,
  addFont: 5,
  titlePadY: 6,
  titlePadX: 12,
  addPadY: 4,
  addPadX: 8,
  gapTitleBody: 6,
  gapBodyAdd: 6,
  gapAddItems: 3,
  cardPadY: 6,
  cardPadX: 12,
};

const FIT_STYLE_PROPS = [
  "--title-font",
  "--body-font",
  "--add-font",
  "--title-pad-y",
  "--title-pad-x",
  "--add-pad-y",
  "--add-pad-x",
  "--gap-title-body",
  "--gap-body-add",
  "--gap-add-items",
  "--a4-card-pad-y",
  "--a4-card-pad-x",
] as const;

function resolveMaxBodyFont(options: A4DomFitOptions): number {
  if (options.maxBodyFont == null) return A4_FIT_GROW_CEILING;
  return options.maxBodyFont;
}

function a4DefaultFitState(font = 10): FitState {
  return {
    titleFont: font,
    bodyFont: font,
    addFont: Math.max(4, font - 1),
    titlePadY: 8,
    titlePadX: 40,
    addPadY: 8,
    addPadX: 12,
    gapTitleBody: 18,
    gapBodyAdd: 18,
    gapAddItems: 9,
    cardPadY: 12,
    cardPadX: 12,
  };
}

function a4ApplyFitState(card: HTMLElement, state: FitState) {
  card.style.setProperty("--title-font", state.titleFont + "px");
  card.style.setProperty("--body-font", state.bodyFont + "px");
  card.style.setProperty("--add-font", state.addFont + "px");
  card.style.setProperty("--title-pad-y", state.titlePadY + "px");
  card.style.setProperty("--title-pad-x", state.titlePadX + "px");
  card.style.setProperty("--add-pad-y", state.addPadY + "px");
  card.style.setProperty("--add-pad-x", state.addPadX + "px");
  card.style.setProperty("--gap-title-body", state.gapTitleBody + "px");
  card.style.setProperty("--gap-body-add", state.gapBodyAdd + "px");
  card.style.setProperty("--gap-add-items", state.gapAddItems + "px");
  card.style.setProperty("--a4-card-pad-y", state.cardPadY + "px");
  card.style.setProperty("--a4-card-pad-x", state.cardPadX + "px");
}

function a4LastContentBottom(card: HTMLElement): number {
  const cardRect = card.getBoundingClientRect();
  let bottom = cardRect.top;
  const selectors = [
    ".a4-title-pill",
    ".a4-title-pill span",
    ".a4-body p",
    ".a4-body li",
    ".a4-addendum-item",
    ".a4-side-formula",
    ".a4-side-addendum p",
  ];
  selectors.forEach((selector) => {
    card.querySelectorAll(selector).forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) bottom = Math.max(bottom, rect.bottom);
    });
  });
  return bottom - cardRect.top;
}

function a4MeasureCard(card: HTMLElement): CardMeasure {
  const cs = getComputedStyle(card);
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  const cardRect = card.getBoundingClientRect();
  const scaleY = card.clientHeight > 0 ? cardRect.height / card.clientHeight : 1;
  const allowedBottom = card.clientHeight - padBottom;
  const bottom = a4LastContentBottom(card) / (scaleY || 1);
  const overflowY = bottom > allowedBottom + 0.5;
  const overflowX = card.scrollWidth > card.clientWidth + 0.5;
  return {
    scrollHeight: Math.round(bottom + padBottom),
    clientHeight: card.clientHeight,
    overflow: overflowY || overflowX,
    free: allowedBottom - bottom,
  };
}

function readFitState(card: HTMLElement): FitState {
  const cs = getComputedStyle(card);
  const bodyFont = Number.parseFloat(cs.getPropertyValue("--body-font")) || 10;
  return {
    titleFont: Number.parseFloat(cs.getPropertyValue("--title-font")) || bodyFont,
    bodyFont,
    addFont: Number.parseFloat(cs.getPropertyValue("--add-font")) || Math.max(5, bodyFont - 1),
    titlePadY: Number.parseFloat(cs.getPropertyValue("--title-pad-y")) || 8,
    titlePadX: Number.parseFloat(cs.getPropertyValue("--title-pad-x")) || 40,
    addPadY: Number.parseFloat(cs.getPropertyValue("--add-pad-y")) || 8,
    addPadX: Number.parseFloat(cs.getPropertyValue("--add-pad-x")) || 12,
    gapTitleBody: Number.parseFloat(cs.getPropertyValue("--gap-title-body")) || 18,
    gapBodyAdd: Number.parseFloat(cs.getPropertyValue("--gap-body-add")) || 18,
    gapAddItems: Number.parseFloat(cs.getPropertyValue("--gap-add-items")) || 9,
    cardPadY: Number.parseFloat(cs.getPropertyValue("--a4-card-pad-y")) || 12,
    cardPadX: Number.parseFloat(cs.getPropertyValue("--a4-card-pad-x")) || 12,
  };
}

export function captureA4FitStyles(root: HTMLElement): Map<HTMLElement, Record<string, string>> {
  const snapshot = new Map<HTMLElement, Record<string, string>>();
  root.querySelectorAll('.a4-card[data-a4-fit-card="1"]').forEach((node) => {
    const el = node as HTMLElement;
    const props: Record<string, string> = {};
    FIT_STYLE_PROPS.forEach((prop) => {
      props[prop] = el.style.getPropertyValue(prop);
    });
    snapshot.set(el, props);
  });
  return snapshot;
}

export function restoreA4FitStyles(snapshot: Map<HTMLElement, Record<string, string>>) {
  snapshot.forEach((props, el) => {
    FIT_STYLE_PROPS.forEach((prop) => {
      const value = props[prop];
      if (value) el.style.setProperty(prop, value);
      else el.style.removeProperty(prop);
    });
  });
}

function a4NormalizeTitlePadding(card: HTMLElement, state: FitState): FitState {
  const s = { ...state };
  const title = card.querySelector(".a4-title-pill") as HTMLElement | null;
  if (!title) return s;

  for (let px = 40; px >= A4_FIT_MIN.titlePadX; px -= 4) {
    s.titlePadX = px;
    a4ApplyFitState(card, s);
    const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight) || 12;
    const lines = Math.max(1, Math.round(title.scrollHeight / lineHeight));
    if (lines <= 1 && title.scrollWidth <= title.clientWidth + 1) return { ...s };
  }

  s.titlePadX = A4_FIT_MIN.titlePadX;
  a4ApplyFitState(card, s);
  return s;
}

function a4FitCardIndependent(card: HTMLElement, options: A4DomFitOptions) {
  const maxFont = resolveMaxBodyFont(options);
  let best: { state: FitState; measure: CardMeasure; stage: string } | null = null;
  card.querySelectorAll(".a4-fit-badge").forEach((b) => b.remove());
  card.classList.remove("fit-overflow");

  const standard = a4NormalizeTitlePadding(card, a4DefaultFitState(10));
  a4ApplyFitState(card, standard);
  const standardMeasure = a4MeasureCard(card);

  function growFromStandard(baseState: FitState) {
    let previous = { state: { ...baseState }, measure: a4MeasureCard(card), stage: "base" };
    for (let font = 10.25; font <= maxFont; font += 0.25) {
      const st = a4NormalizeTitlePadding(card, { ...a4DefaultFitState(font), cardPadY: 12, cardPadX: 12, gapTitleBody: 18, gapBodyAdd: 18 });
      a4ApplyFitState(card, st);
      const m = a4MeasureCard(card);
      if (m.overflow) break;
      previous = { state: { ...st }, measure: m, stage: "grow font" };
    }
    return previous;
  }

  if (!standardMeasure.overflow) {
    best = growFromStandard(standard);
  }

  if (!best) {
    for (const pad of [12, 10, 8, 6]) {
      for (const gapTitle of [18, 14, 10, 6]) {
        for (const gapAdd of [18, 14, 10, 6]) {
          const st = { ...standard, cardPadY: pad, gapTitleBody: gapTitle, gapBodyAdd: gapAdd };
          a4ApplyFitState(card, st);
          const m = a4MeasureCard(card);
          if (!m.overflow) {
            best = growFromStandard(st);
            break;
          }
        }
        if (best) break;
      }
      if (best) break;
    }
  }

  if (!best) {
    for (let font = 10; font >= A4_FIT_MIN.bodyFont; font -= 0.25) {
      const st = a4NormalizeTitlePadding(card, { ...a4DefaultFitState(font), cardPadY: 12, cardPadX: 12, gapTitleBody: 18, gapBodyAdd: 18 });
      a4ApplyFitState(card, st);
      const m = a4MeasureCard(card);
      if (!m.overflow) {
        best = { state: { ...st }, measure: m, stage: "shrink font" };
        break;
      }
    }
  }

  if (!best) {
    const st = {
      ...a4DefaultFitState(A4_FIT_MIN.bodyFont),
      cardPadY: A4_FIT_MIN.cardPadY,
      cardPadX: A4_FIT_MIN.cardPadX,
      gapTitleBody: A4_FIT_MIN.gapTitleBody,
      gapBodyAdd: A4_FIT_MIN.gapBodyAdd,
    };
    a4ApplyFitState(card, st);
    best = { state: st, measure: a4MeasureCard(card), stage: "minimum" };
  }

  a4ApplyFitState(card, best.state);
  const after = a4MeasureCard(card);
  card.classList.toggle("fit-overflow", after.overflow);
  return { ...best, measure: after };
}

function isElementActuallyVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  return el.clientWidth > 0 && el.clientHeight > 0 && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden";
}

function isCardMeasurable(card: HTMLElement): boolean {
  return Boolean(card && isElementActuallyVisible(card) && card.clientWidth > 0 && card.clientHeight > 0);
}

function a4GrowCardToFill(card: HTMLElement, baseState: FitState, options: A4DomFitOptions) {
  const maxFont = resolveMaxBodyFont(options);
  let best = { ...baseState };
  a4ApplyFitState(card, best);

  for (let font = baseState.bodyFont; font <= maxFont; font += 0.25) {
    const st = a4NormalizeTitlePadding(card, {
      ...best,
      titleFont: font,
      bodyFont: font,
      addFont: Math.max(5, font - 1),
    });
    a4ApplyFitState(card, st);
    if (a4MeasureCard(card).overflow) break;
    best = { ...st };
  }

  for (const gapTitle of [18, 22, 26, 30, 34, 38, 42]) {
    if (gapTitle <= best.gapTitleBody) continue;
    const st = { ...best, gapTitleBody: gapTitle, gapBodyAdd: Math.max(best.gapBodyAdd, gapTitle - 4) };
    a4ApplyFitState(card, st);
    if (a4MeasureCard(card).overflow) break;
    best = { ...st };
  }

  for (const cardPad of [12, 14, 16, 18, 20, 22, 24, 28, 32]) {
    if (cardPad <= best.cardPadY) continue;
    const st = { ...best, cardPadY: cardPad, cardPadX: cardPad };
    a4ApplyFitState(card, st);
    if (a4MeasureCard(card).overflow) break;
    best = { ...st };
  }

  a4ApplyFitState(card, best);
}

function a4GrowRowTogether(cards: HTMLElement[], options: A4DomFitOptions) {
  if (cards.length === 0) return;
  const maxFont = resolveMaxBodyFont(options);
  const baseStates = cards.map((card) => readFitState(card));
  let bestStates = baseStates.map((s) => ({ ...s }));

  for (let font = Math.min(...baseStates.map((s) => s.bodyFont)); font <= maxFont; font += 0.25) {
    const trial = bestStates.map((s, i) =>
      a4NormalizeTitlePadding(cards[i], {
        ...s,
        titleFont: font,
        bodyFont: font,
        addFont: Math.max(5, font - 1),
      }),
    );
    trial.forEach((st, i) => a4ApplyFitState(cards[i], st));
    if (cards.some((card) => a4MeasureCard(card).overflow)) break;
    bestStates = trial.map((s) => ({ ...s }));
  }

  const gapSteps = [18, 22, 26, 30, 34, 38, 42, 46, 50];
  for (const gapTitle of gapSteps) {
    const trial = bestStates.map((s) => ({
      ...s,
      gapTitleBody: Math.max(s.gapTitleBody, gapTitle),
      gapBodyAdd: Math.max(s.gapBodyAdd, gapTitle - 4),
    }));
    trial.forEach((st, i) => a4ApplyFitState(cards[i], st));
    if (cards.some((card) => a4MeasureCard(card).overflow)) break;
    bestStates = trial;
  }

  bestStates.forEach((st, i) => a4ApplyFitState(cards[i], st));
}

function a4FillVerticalSpace(root: HTMLElement, options: A4DomFitOptions) {
  root.querySelectorAll(".a4-row").forEach((row) => {
    const cards = Array.from(row.querySelectorAll('.a4-card[data-a4-fit-card="1"]')).filter((c): c is HTMLElement =>
      isCardMeasurable(c as HTMLElement),
    );
    if (cards.length === 0) return;
    if (cards.length === 1) {
      a4GrowCardToFill(cards[0], readFitState(cards[0]), options);
      return;
    }
    a4GrowRowTogether(cards, options);
  });
}

function normalizeRowFontSpread(root: HTMLElement) {
  root.querySelectorAll(".a4-row").forEach((row) => {
    const cards = Array.from(row.querySelectorAll('.a4-card[data-a4-fit-card="1"]')).filter((c): c is HTMLElement => isCardMeasurable(c as HTMLElement));
    if (cards.length < 2) return;

    const bodySizes = cards.map((card) => Number.parseFloat(getComputedStyle(card).getPropertyValue("--body-font")) || 10);
    const titleSizes = cards.map((card) => Number.parseFloat(getComputedStyle(card).getPropertyValue("--title-font")) || 10);
    const minBody = Math.min(...bodySizes);
    const minTitle = Math.min(...titleSizes);

    cards.forEach((card, i) => {
      const bodyTooLarge = bodySizes[i] - minBody > 0.5;
      const titleTooLarge = titleSizes[i] - minTitle > 0.5;
      if (bodyTooLarge || titleTooLarge) {
        const current: FitState = {
          titleFont: titleTooLarge ? minTitle : titleSizes[i],
          bodyFont: bodyTooLarge ? minBody : bodySizes[i],
          addFont: Math.max(5, (bodyTooLarge ? minBody : bodySizes[i]) - 1),
          titlePadY: Number.parseFloat(getComputedStyle(card).getPropertyValue("--title-pad-y")) || 8,
          titlePadX: Number.parseFloat(getComputedStyle(card).getPropertyValue("--title-pad-x")) || 12,
          addPadY: 8,
          addPadX: 12,
          gapTitleBody: 18,
          gapBodyAdd: 18,
          gapAddItems: 9,
          cardPadY: 12,
          cardPadX: 12,
        };
        a4ApplyFitState(card, current);
      }
    });
  });
}

export function runA4DomFit(
  root: HTMLElement,
  rowTargets: A4RowTargets,
  visible = true,
  options: A4DomFitOptions = DEFAULT_A4_DOM_FIT_OPTIONS,
): string {
  if (!visible) {
    return "A4 построен. Подгонка будет выполнена после открытия вкладки.";
  }

  const cards = Array.from(root.querySelectorAll('.a4-card[data-a4-fit-card="1"]')) as HTMLElement[];
  const measurable = cards.filter(isCardMeasurable);
  if (cards.length && measurable.length !== cards.length) {
    return `A4 построен, но ${cards.length - measurable.length} карточек пока не имеют реального DOM-размера.`;
  }

  const results = cards.map((card) => a4FitCardIndependent(card, options));
  if (options.balanceRowFonts) {
    normalizeRowFontSpread(root);
    a4FillVerticalSpace(root, options);
  } else {
    cards.forEach((card) => a4GrowCardToFill(card, readFitState(card), options));
  }

  const overflowCount = results.filter((r) => r.measure.overflow).length;
  const freeTotal = results.reduce((sum, r) => sum + Math.max(0, r.measure.free), 0);
  const target = options.fitTarget ?? "screen";
  return `A4 [${target}] fixed windows: header ${Math.round(rowTargets.headerHeight || 0)}px, row scale ${Math.round(rowTargets.rowScale * 1000) / 1000}, row gap ${Math.round(rowTargets.rowGap * 100) / 100}px, fixed row heights ${rowTargets.targetHeights.map((h) => Math.round(h)).join("/")} , cards ${cards.length}, overflow ${overflowCount}, total free ${Math.round(freeTotal)}px.`;
}

export function checkA4Overflow(root: HTMLElement): string[] {
  const cards = Array.from(root.querySelectorAll(".a4-card")).filter((c): c is HTMLElement => isCardMeasurable(c as HTMLElement));
  const problems: string[] = [];
  cards.forEach((card, idx) => {
    const m = a4MeasureCard(card);
    card.classList.toggle("fit-overflow", m.overflow);
    if (m.overflow) {
      const title = card.querySelector(".a4-title-pill")?.textContent?.trim() || `card ${idx + 1}`;
      problems.push(`${idx + 1}. ${title}: overflow ${Math.ceil(Math.max(0, -m.free))} px`);
    }
  });
  return problems;
}

export { A4_DOM_FIT_SCREEN_OPTIONS, A4_DOM_FIT_EXPORT_OPTIONS };
