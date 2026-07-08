import type katexType from "katex";

type KatexApi = typeof katexType;

const INLINE_MATH_RE =
  /\$\$([\s\S]+?)\$\$|(?<!\$)\$(?!\$)((?:\\.|[^$\\])+?)\$(?!\$)|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;

const INLINE_MATH_TEST_RE =
  /\$\$[\s\S]+?\$\$|(?<!\$)\$(?!\$)(?:\\.|[^$\\])+?\$(?!\$)|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/;

const BLOCK_FORMULA_SELECTOR = ".a4-formula p, .a4-side-formula";
const INLINE_TEXT_ROOT_SELECTOR = ".a4-body, .a4-addendum-item, .a4-header-summary";

let katexPromise: Promise<KatexApi> | null = null;

function loadKatex(): Promise<KatexApi> {
  if (!katexPromise) {
    katexPromise = import("katex").then((mod) => mod.default);
  }
  return katexPromise;
}

export function stripLatexDelimiters(raw: string): string {
  let x = String(raw || "").trim();
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

function tryBreakWideFormulaAtPlus(latex: string): string {
  if (/\\begin\{/.test(latex)) return latex;
  const eq = latex.match(/^(.+?=\s*)([\s\S]+)$/);
  if (!eq) return latex;
  const [, lhs, rhs] = eq;
  if (!rhs.includes("+")) return latex;
  const terms = rhs.split(/\s*\+\s*/).filter(Boolean);
  if (terms.length < 2) return latex;
  const lines = [`&${terms[0]}`];
  for (let i = 1; i < terms.length; i++) {
    lines.push(`&+ ${terms[i]}`);
  }
  return `${lhs}\\begin{aligned}${lines.join(" \\\\ ")}\\end{aligned}`;
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

function fitBlockKatex(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(BLOCK_FORMULA_SELECTOR).forEach((node) => {
    const container = node.closest(".a4-formula, .a4-side-formula") as HTMLElement | null;
    if (!container) return;
    const katexEl = node.querySelector<HTMLElement>(".katex, .katex-display");
    if (!katexEl) return;

    shrinkKatexToFit(katexEl, container);

    if (katexEl.scrollWidth <= container.clientWidth + 1) return;
    const latex = node.dataset.a4LatexSource;
    if (!latex || node.dataset.a4KatexRetried === "1") return;

    const broken = tryBreakWideFormulaAtPlus(latex);
    if (broken === latex) return;

    node.dataset.a4KatexRetried = "1";
    void loadKatex().then((katex) => {
      node.textContent = "";
      renderKatex(node, broken, true, katex);
      const next = node.querySelector<HTMLElement>(".katex, .katex-display");
      if (next) shrinkKatexToFit(next, container);
    });
  });
}

function typesetBlockFormulas(root: HTMLElement, katex: KatexApi) {
  root.querySelectorAll<HTMLElement>(BLOCK_FORMULA_SELECTOR).forEach((node) => {
    const raw = node.textContent?.trim();
    if (!raw) return;
    if (node.querySelector(".katex") && !textNeedsInlineTypeset(raw) && !raw.includes("$")) return;

    const latex = stripLatexDelimiters(raw);
    node.dataset.a4LatexSource = latex;
    node.dataset.a4KatexRetried = "";
    node.textContent = "";
    renderKatex(node, latex, true, katex);
  });
}

function typesetInlineMathInTextNode(textNode: Text, katex: KatexApi) {
  const text = textNode.textContent || "";
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
    const isDisplay = Boolean(displayLatex || match[4]);

    const span = document.createElement("span");
    span.className = isDisplay ? "a4-katex-display-inline" : "a4-katex-inline";
    renderKatex(span, latex, isDisplay, katex);
    frag.appendChild(span);
    lastIndex = INLINE_MATH_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  parent.replaceChild(frag, textNode);
}

function typesetInlineMath(root: HTMLElement, katex: KatexApi) {
  const textNodes: Text[] = [];
  root.querySelectorAll(INLINE_TEXT_ROOT_SELECTOR).forEach((container) => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const textNode = current as Text;
      const parent = textNode.parentElement;
      if (parent && !parent.closest(".katex, .a4-formula, .a4-side-formula")) {
        textNodes.push(textNode);
      }
      current = walker.nextNode();
    }
  });

  textNodes.forEach((node) => typesetInlineMathInTextNode(node, katex));
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
      if (parent && !parent.closest(".katex, .a4-formula, .a4-side-formula") && textNeedsInlineTypeset(text)) {
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
