import type katexType from "katex";

type KatexApi = typeof katexType;

const INLINE_MATH_RE =
  /\$\$([\s\S]+?)\$\$|(?<!\$)\$(?!\$)((?:\\.|[^$\\])+?)\$(?!\$)|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;

const INLINE_MATH_TEST_RE =
  /\$\$[\s\S]+?\$\$|(?<!\$)\$(?!\$)(?:\\.|[^$\\])+?\$(?!\$)|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/;

const BLOCK_FORMULA_SELECTOR = ".a4-formula p, .a4-side-formula, .a4-addendum-item p[data-a4-latex]";
const INLINE_TEXT_ROOT_SELECTOR = ".a4-body, .a4-addendum-item, .a4-header-summary";

let katexPromise: Promise<KatexApi> | null = null;

function loadKatex(): Promise<KatexApi> {
  if (!katexPromise) {
    katexPromise = import("katex").then((mod) => mod.default);
  }
  return katexPromise;
}

export function normalizeDisplayDollars(text: string): string {
  return String(text || "").replace(/\$\$([\s\S]+?)\$\$/g, (_match, inner: string) => `$${String(inner).trim()}$`);
}

function shouldUseDisplayMode(latex: string): boolean {
  return /\\begin\{(aligned|cases|gathered|split)\}/.test(latex);
}

export function stripLatexDelimiters(raw: string): string {
  let x = normalizeDisplayDollars(String(raw || "").trim());
  const display = x.match(/^\$\$([\s\S]*?)\$\$$/);
  if (display) return display[1].trim();
  const inline = x.match(/^\$([\s\S]*?)\$$/);
  if (inline) return inline[1].trim();
  const paren = x.match(/^\\\(([\s\S]*?)\\\)$/);
  if (paren) return paren[1].trim();
  const bracket = x.match(/^\\\[([\s\S]*?)\\\]$/);
  if (bracket) return bracket[1].trim();
  return x;
}

function textNeedsInlineTypeset(text: string): boolean {
  return INLINE_MATH_TEST_RE.test(text);
}

function findBreakableOperators(latex: string): Array<{ index: number; op: "+" | "=" }> {
  const breaks: Array<{ index: number; op: "+" | "=" }> = [];
  let depth = 0;
  for (let i = 0; i < latex.length; i++) {
    const ch = latex[i];
    if (ch === "\\") {
      i++;
      while (i < latex.length && /[a-zA-Z]/.test(latex[i])) i++;
      continue;
    }
    if (ch === "{") {
      depth++;
      continue;
    }
    if (ch === "}") {
      if (depth > 0) depth--;
      continue;
    }
    if (depth === 0 && (ch === "+" || ch === "=")) {
      breaks.push({ index: i, op: ch });
    }
  }
  return breaks;
}

function buildAlignedAtPlus(latex: string, plusIndices: number[]): string {
  const segments: string[] = [];
  let last = 0;
  for (const idx of plusIndices) {
    segments.push(latex.slice(last, idx).trim());
    last = idx + 1;
  }
  segments.push(latex.slice(last).trim());
  if (segments.length < 2) return latex;

  const lines = [`&${segments[0]} +`];
  for (let i = 1; i < segments.length - 1; i++) {
    lines.push(`&+ ${segments[i]} +`);
  }
  lines.push(`&+ ${segments[segments.length - 1]}`);
  return `\\begin{aligned}${lines.join(" \\\\ ")}\\end{aligned}`;
}

function buildAlignedAtEquals(latex: string, eqIndex: number): string {
  const lhs = latex.slice(0, eqIndex).trim();
  const rhs = latex.slice(eqIndex + 1).trim();
  if (!lhs || !rhs) return latex;
  return `\\begin{aligned}&${lhs} = \\\\ &= ${rhs}\\end{aligned}`;
}

function tryBreakWideFormula(latex: string): string {
  if (/\\begin\{/.test(latex)) return latex;

  const breaks = findBreakableOperators(latex);
  if (!breaks.length) return latex;

  const plusBreaks = breaks.filter((b) => b.op === "+").map((b) => b.index);
  if (plusBreaks.length >= 1) {
    return buildAlignedAtPlus(latex, plusBreaks);
  }

  const eqBreak = breaks.find((b) => b.op === "=");
  if (eqBreak) {
    return buildAlignedAtEquals(latex, eqBreak.index);
  }

  return latex;
}

function renderKatex(node: HTMLElement, latex: string, displayMode: boolean, katex: KatexApi) {
  try {
    katex.render(latex, node, { throwOnError: false, displayMode });
  } catch {
    node.textContent = latex;
  }
}

function shrinkKatexToFit(katexEl: HTMLElement, container: HTMLElement) {
  const maxW = Math.max(0, container.clientWidth - 4);
  if (maxW <= 0) return;

  katexEl.style.fontSize = "";
  let fontSize = Number.parseFloat(getComputedStyle(katexEl).fontSize) || 10;
  const baseFont = fontSize;
  const minFont = Math.max(6, baseFont * 0.55);

  while (katexEl.scrollWidth > maxW + 1 && fontSize > minFont) {
    fontSize -= 0.5;
    katexEl.style.fontSize = `${fontSize}px`;
  }
}

export function refitA4BlockFormulas(root: HTMLElement) {
  fitBlockKatex(root);
}

function formulaFitContainer(node: HTMLElement): HTMLElement {
  return (
    (node.closest(".a4-formula, .a4-side-formula") as HTMLElement | null) ??
    (node.matches("p[data-a4-latex]") ? ((node.parentElement as HTMLElement | null) ?? node) : node)
  );
}

function fitBlockKatex(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(BLOCK_FORMULA_SELECTOR).forEach((node) => {
    const container = formulaFitContainer(node);
    const katexEl = node.querySelector<HTMLElement>(".katex, .katex-display");
    if (!katexEl) return;

    shrinkKatexToFit(katexEl, container);

    if (katexEl.scrollWidth <= container.clientWidth + 1) return;
    const latex = node.dataset.a4LatexSource;
    if (!latex || node.dataset.a4KatexRetried === "1") return;

    const broken = tryBreakWideFormula(latex);
    if (broken === latex) return;

    node.dataset.a4KatexRetried = "1";
    void loadKatex().then((katex) => {
      node.textContent = "";
      renderKatex(node, broken, shouldUseDisplayMode(broken), katex);
      const next = node.querySelector<HTMLElement>(".katex, .katex-display");
      if (next) shrinkKatexToFit(next, container);
    });
  });
}

function typesetBlockFormulas(root: HTMLElement, katex: KatexApi) {
  root.querySelectorAll<HTMLElement>(BLOCK_FORMULA_SELECTOR).forEach((node) => {
    const raw = normalizeDisplayDollars(node.textContent?.trim() || "");
    if (!raw) return;
    if (node.querySelector(".katex") && !textNeedsInlineTypeset(raw) && !raw.includes("$")) return;

    const latex = stripLatexDelimiters(raw);
    node.dataset.a4LatexSource = latex;
    node.dataset.a4KatexRetried = "";
    node.textContent = "";
    renderKatex(node, latex, shouldUseDisplayMode(latex), katex);
  });
}

function typesetInlineMathInTextNode(textNode: Text, katex: KatexApi) {
  const text = normalizeDisplayDollars(textNode.textContent || "");
  if (!textNeedsInlineTypeset(text)) return;

  INLINE_MATH_RE.lastIndex = 0;
  if (!INLINE_MATH_RE.test(text)) return;
  INLINE_MATH_RE.lastIndex = 0;

  const parent = textNode.parentElement;
  if (!parent || parent.closest(".katex")) return;

  const frag = document.createDocumentFragment();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_MATH_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const displayLatex = match[1];
    const inlineLatex = match[2] ?? match[3] ?? match[4];
    const latex = (displayLatex ?? inlineLatex ?? "").trim();
    const displayMode = shouldUseDisplayMode(latex);

    const span = document.createElement("span");
    span.className = displayMode ? "a4-katex-display-inline" : "a4-katex-inline";
    renderKatex(span, latex, displayMode, katex);
    frag.appendChild(span);
    lastIndex = INLINE_MATH_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  parent.replaceChild(frag, textNode);
}

function typesetInlineMathInElement(container: HTMLElement, katex: KatexApi) {
  container.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      typesetInlineMathInTextNode(child as Text, katex);
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    if (el.tagName === "BR" || el.closest(".katex, .a4-formula, .a4-side-formula, p[data-a4-latex]")) return;
    typesetInlineMathInElement(el, katex);
  });
}

function typesetInlineMath(root: HTMLElement, katex: KatexApi) {
  root.querySelectorAll(INLINE_TEXT_ROOT_SELECTOR).forEach((container) => {
    if ((container as HTMLElement).matches?.("p[data-a4-latex]")) return;
    typesetInlineMathInElement(container as HTMLElement, katex);
  });
}

export function needsA4FormulaTypeset(root: HTMLElement): boolean {
  let pending = false;
  root.querySelectorAll<HTMLElement>(BLOCK_FORMULA_SELECTOR).forEach((node) => {
    const raw = node.textContent?.trim() || "";
    if (!raw) return;
    if (!node.querySelector(".katex") || raw.includes("$") || textNeedsInlineTypeset(raw)) pending = true;
  });
  if (pending) return true;

  root.querySelectorAll(INLINE_TEXT_ROOT_SELECTOR).forEach((container) => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const text = (current as Text).textContent || "";
      const parent = (current as Text).parentElement;
      if (parent && !parent.closest(".katex, .a4-formula, .a4-side-formula, p[data-a4-latex]") && textNeedsInlineTypeset(text)) {
        pending = true;
        break;
      }
      current = walker.nextNode();
    }
  });
  return pending;
}

async function typesetA4FormulasSync(root: HTMLElement, katex: KatexApi) {
  typesetBlockFormulas(root, katex);
  typesetInlineMath(root, katex);
  fitBlockKatex(root);
}

export function typesetA4Formulas(root: HTMLElement) {
  void loadKatex().then((katex) => typesetA4FormulasSync(root, katex));
}

export async function typesetA4FormulasAndWait(root: HTMLElement, timeoutMs = 4000): Promise<void> {
  const katex = await loadKatex();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await typesetA4FormulasSync(root, katex);
    if (!needsA4FormulaTypeset(root)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  await typesetA4FormulasSync(root, katex);
}

export async function waitForA4FormulaTypeset(root: HTMLElement, timeoutMs = 4000): Promise<void> {
  await typesetA4FormulasAndWait(root, timeoutMs);
}
