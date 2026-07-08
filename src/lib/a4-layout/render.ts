import { isWideCardFraction } from "@/lib/a4-layout/constants";
import { sanitizeAIHtml } from "@/lib/a4-layout/sanitize-ai-html";
import type { A4LayoutSettings, A4LayoutSummary, A4RenderOptions, LayoutEntity, WidthReport } from "@/lib/a4-layout/types";
import { asArray, escapeHtml, flattenText, textStats } from "@/lib/a4-layout/text";
import { metaText } from "@/lib/a4-layout/estimate";

export function a4LatexText(text: unknown): string {
  let x = String(text ?? "").trim();
  x = x.replace(/\\([A-Za-z]+)/g, "\\$1").replace(/\\([{}])/g, "\\$1");
  const display = x.match(/^\$\$([\s\S]*?)\$\$$/);
  if (display) return "\\(" + display[1].trim() + "\\)";
  return x;
}

function a4ChooseAddendumLayout(addItems: string[], fraction: number, placement: string) {
  if (placement === "right") return "stack";
  const maxLen = addItems.reduce((m, x) => Math.max(m, String(x).length), 0);
  if (addItems.length === 2 && maxLen <= 42 && isWideCardFraction(fraction)) return "row";
  return "stack";
}

export function a4BodyHtml(entity: LayoutEntity): string {
  const contentItems = asArray(entity.content).map((v) => flattenText(v)).filter(Boolean);
  if (!contentItems.length) return "";
  if (Array.isArray(entity.content)) {
    const tag = entity.entityType === "actionList" ? "ol" : "ul";
    return `<div class="a4-body"><${tag}>${contentItems.map((item) => `<li>${escapeHtml(String(item).replace(/^\s*\d+[\.)]\s*/, ""))}</li>`).join("")}</${tag}></div>`;
  }
  const paragraphs = contentItems.join("\n\n").split(/\n{2,}/).filter(Boolean);
  return `<div class="a4-body">${paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
}

function aiBodyHtml(entity: LayoutEntity): string {
  if (!entity.contentHtml) return a4BodyHtml(entity);
  const html = String(entity.content || "").trim();
  if (!html) return "";
  return `<div class="a4-body">${sanitizeAIHtml(html)}</div>`;
}

function a4IsLatexLike(value: string): boolean {
  const t = String(value || "").trim();
  return /^\$\$[\s\S]*\$\$$/.test(t) || /^\\\([\s\S]*\\\)$/.test(t) || /^\\\[[\s\S]*\\\]$/.test(t);
}

function a4RenderAddendumItemContent(item: string, allowHtml = false): string {
  const text = String(item || "").trim();
  if (a4IsLatexLike(text)) return escapeHtml(a4LatexText(text));
  return allowHtml ? sanitizeAIHtml(text) : escapeHtml(text);
}

function a4ExplicitAddendumHtml(
  itemsValue: unknown,
  fraction: number,
  placement: string,
  layout: string = "single",
  allowHtml = false,
): string {
  const items = asArray(itemsValue).map((v) => flattenText(v)).filter(Boolean).slice(0, 4);
  if (!items.length) return "";

  let safeLayout = ["single", "stack", "row", "grid"].includes(layout) ? layout : "single";
  if (items.length === 1) safeLayout = "single";
  if (safeLayout === "grid" && items.length < 4) safeLayout = items.length <= 2 ? "row" : "stack";
  if (safeLayout === "row" && items.length > 3) safeLayout = "grid";

  if (safeLayout === "single") {
    return `<div class="a4-addendum-item a4-addendum-combined"><p>${a4RenderAddendumItemContent(items.join("<br>"), allowHtml)}</p></div>`;
  }

  if (safeLayout === "stack") {
    const content = items.map((item) => `<p>${a4RenderAddendumItemContent(item, allowHtml)}</p>`).join("");
    return `<div class="a4-addendum-item a4-addendum-combined">${content}</div>`;
  }

  const cls = safeLayout === "row" ? "a4-addendum-row" : "a4-addendum-grid";
  return `<div class="${cls}">${items.map((item) => `<div class="a4-addendum-item"><p>${a4RenderAddendumItemContent(item, allowHtml)}</p></div>`).join("")}</div>`;
}

function a4FormulaHtml(value: unknown): string {
  const items = asArray(value).map((v) => flattenText(v)).filter(Boolean);
  if (!items.length) return "";
  return `<div class="a4-addendum-item a4-addendum-combined a4-formula">${items.map((v) => `<p>${escapeHtml(a4LatexText(v))}</p>`).join("")}</div>`;
}

function a4AddendumHtml(value: unknown, fraction: number, placement: string): string {
  const items = asArray(value).map((v) => flattenText(v)).filter(Boolean);
  if (!items.length) return "";
  const layout = a4ChooseAddendumLayout(items, fraction, placement);

  if (layout === "stack") {
    const content = items.map((item) => `<p>${escapeHtml(item)}</p>`).join("");
    return `<div class="a4-addendum-item a4-addendum-combined">${content}</div>`;
  }

  const cls = layout === "row" ? "a4-addendum-row" : "a4-addendum-grid";
  return `<div class="${cls}">${items.map((item) => `<div class="a4-addendum-item"><p>${escapeHtml(item)}</p></div>`).join("")}</div>`;
}

function a4SideFormulaAddendumHtml(formulaValue: unknown, addendumValue: unknown): string {
  const formulaItems = asArray(formulaValue).map((v) => flattenText(v)).filter(Boolean);
  const addItems = asArray(addendumValue).map((v) => flattenText(v)).filter(Boolean);
  if (!formulaItems.length && !addItems.length) return "";
  const formula = formulaItems.map((v) => `<div class="a4-side-formula">${escapeHtml(a4LatexText(v))}</div>`).join("");
  const add = addItems.length
    ? `<div class="a4-side-addendum">${addItems.map((v) => `<p>${escapeHtml(v)}</p>`).join("")}</div>`
    : "";
  return `<div class="a4-addendum-zone"><div class="a4-addendum-item a4-side-combined">${formula}${add}</div></div>`;
}

function cardAuxFlags(entity: LayoutEntity) {
  const aiAdd = entity.aiAddendums || null;
  const aiItems = aiAdd ? asArray(aiAdd.items).map((v) => flattenText(v)).filter(Boolean).slice(0, 4) : [];
  return {
    aiAdd,
    aiItems,
    hasAIAddendum: aiItems.length > 0,
    aiPlacement: aiAdd?.placement === "right" ? ("right" as const) : ("below" as const),
    hasFormula: textStats(entity.formula).chars > 0,
    hasAddendum: textStats(entity.cardAddendum).chars > 0,
  };
}

function resolveUseRightColumn(
  entity: LayoutEntity,
  report: WidthReport | null,
  fraction: number,
  renderOptions?: A4RenderOptions,
): boolean {
  const allowRight = renderOptions?.allowAddendumRight !== false;
  const { hasAIAddendum, aiAdd, hasFormula, hasAddendum } = cardAuxFlags(entity);

  if (hasAIAddendum) {
    return allowRight && aiAdd?.placement === "right";
  }

  if (!allowRight) return false;

  if (!isWideCardFraction(fraction)) return false;
  if (!hasFormula && !hasAddendum) return false;

  if (hasAddendum && report?.heightRightPx != null) {
    if (report.bestPlacement === "rightOfBody") return true;
    if (report.heightRightPx < report.heightBelowPx) return true;
  }

  return Boolean(!hasAddendum && hasFormula && textStats(entity.content).chars > 0);
}

export function renderA4CardInner(
  entity: LayoutEntity,
  report: WidthReport | null = null,
  fraction = 1,
  renderOptions?: A4RenderOptions,
): string {
  const { aiAdd, aiItems, hasAIAddendum, aiPlacement, hasFormula, hasAddendum } = cardAuxFlags(entity);
  const title = entity.title ? `<div class="a4-title-pill"><span>${escapeHtml(entity.title)}</span></div>` : "";
  const body = entity.contentHtml ? aiBodyHtml(entity) : a4BodyHtml(entity);
  const useRight = resolveUseRightColumn(entity, report, fraction, renderOptions);

  if (hasAIAddendum) {
    const addHtml = `<div class="a4-addendum-zone">${a4ExplicitAddendumHtml(aiItems, fraction, aiPlacement, aiAdd?.layout || "single", true)}</div>`;
    if (useRight) {
      return `${title}<div class="a4-card-inner"><div class="a4-main-col">${body}</div><div class="a4-side-col">${addHtml}</div></div>`;
    }
    return `${title}${body}${addHtml}`;
  }

  if (useRight) {
    return `${title}<div class="a4-card-inner"><div class="a4-main-col">${body}</div><div class="a4-side-col">${a4SideFormulaAddendumHtml(entity.formula, entity.cardAddendum)}</div></div>`;
  }

  const formula = hasFormula ? a4FormulaHtml(entity.formula) : "";
  const addendum = hasAddendum ? a4AddendumHtml(entity.cardAddendum, fraction, "below") : "";
  const zone = formula || addendum ? `<div class="a4-addendum-zone">${formula}${addendum}</div>` : "";
  return `${title}${body}${zone}`;
}

export function renderA4CardClassName(
  entity: LayoutEntity,
  report: WidthReport | null,
  fraction: number,
  renderOptions?: A4RenderOptions,
): string {
  const useRight = resolveUseRightColumn(entity, report, fraction, renderOptions);
  return [
    "a4-card",
    entity.attention === "core" ? "is-core" : "",
    entity.attention === "accent" ? "is-accent" : "",
    useRight ? "split-right" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function renderA4HeaderHtml(summary: A4LayoutSummary, headerHeight: number, _s: A4LayoutSettings): string {
  const topic = String(summary.topic || "Без заголовка").toUpperCase();
  const summaryText = summary.summary || "";
  const meta = metaText(summary);
  return `<article class="a4-card a4-header-card" style="--a4-header-h:${Math.round(headerHeight)}px; --a4-header-title-font:26.07px; --a4-header-summary-font:14px; --a4-header-title-line:33px; --a4-header-summary-line:18px;">
    ${meta ? `<div class="a4-header-meta">${escapeHtml(meta)}</div>` : ""}
    <div class="a4-header-main">
      <div class="a4-header-title">${escapeHtml(topic)}</div>
      ${summaryText ? `<div class="a4-header-summary">${escapeHtml(summaryText)}</div>` : ""}
    </div>
  </article>`;
}
