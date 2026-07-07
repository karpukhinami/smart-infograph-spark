import type { A4LayoutSettings, A4LayoutSummary, LayoutEntity, WidthReport } from "@/lib/a4-layout/types";
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
  if (addItems.length === 2 && maxLen <= 42 && fraction >= 2 / 3) return "row";
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
  const add = addItems.length ? `<div class="a4-side-addendum">${addItems.map((v) => `<p>${escapeHtml(v)}</p>`).join("")}</div>` : "";
  return `<div class="a4-addendum-zone"><div class="a4-addendum-item a4-side-combined">${formula}${add}</div></div>`;
}

export function renderA4CardInner(entity: LayoutEntity, report: WidthReport | null = null, fraction = 1): string {
  const title = entity.title ? `<div class="a4-title-pill"><span>${escapeHtml(entity.title)}</span></div>` : "";
  const body = a4BodyHtml(entity);
  const hasFormula = textStats(entity.formula).chars > 0;
  const hasAddendum = textStats(entity.cardAddendum).chars > 0;
  const rightByEstimator = Boolean(hasAddendum && report && report.bestPlacement === "rightOfBody" && report.heightRightPx != null);
  const formulaOnlyRight = Boolean(!hasAddendum && hasFormula && fraction >= 2 / 3 && textStats(entity.content).chars > 0);
  const useRight = Boolean((rightByEstimator || formulaOnlyRight) && fraction >= 2 / 3);

  if (useRight) {
    return `${title}<div class="a4-card-inner"><div class="a4-main-col">${body}</div><div class="a4-side-col">${a4SideFormulaAddendumHtml(entity.formula, entity.cardAddendum)}</div></div>`;
  }

  const formula = hasFormula ? a4FormulaHtml(entity.formula) : "";
  const addendum = hasAddendum ? a4AddendumHtml(entity.cardAddendum, fraction, "below") : "";
  const zone = formula || addendum ? `<div class="a4-addendum-zone">${formula}${addendum}</div>` : "";
  return `${title}${body}${zone}`;
}

export function renderA4CardClassName(entity: LayoutEntity, report: WidthReport | null, fraction: number): string {
  const hasAddendum = textStats(entity.cardAddendum).chars > 0;
  const hasFormula = textStats(entity.formula).chars > 0;
  const rightByEstimator = Boolean(hasAddendum && report && report.bestPlacement === "rightOfBody" && report.heightRightPx != null);
  const formulaOnlyRight = Boolean(!hasAddendum && hasFormula && fraction >= 2 / 3 && textStats(entity.content).chars > 0);
  const useRight = Boolean((rightByEstimator || formulaOnlyRight) && fraction >= 2 / 3);
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
  return `<article class="a4-card a4-header-card" style="--a4-header-h:${Math.round(headerHeight)}px; --a4-header-title-font:26.07px; --a4-header-summary-font:14px;">
    ${meta ? `<div class="a4-header-meta">${escapeHtml(meta)}</div>` : ""}
    <div class="a4-header-main">
      <div class="a4-header-title">${escapeHtml(topic)}</div>
      ${summaryText ? `<div class="a4-header-summary">${escapeHtml(summaryText)}</div>` : ""}
    </div>
  </article>`;
}
