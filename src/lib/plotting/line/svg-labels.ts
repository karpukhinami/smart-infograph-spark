/** SVG-подписи с поддержкой KaTeX (как на координатной плоскости). */
import katex from "katex";
import { expressionLatex } from "../math-expr";

function escapeText(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function round(value: number): string {
  return String(Number(value.toFixed(2)));
}

function isPlainNumberLabel(text: string): boolean {
  const t = String(text ?? "").trim();
  return /^[-−]?\d+([.,]\d+)?$/.test(t);
}

export function labelNeedsLatex(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t || isPlainNumberLabel(t)) return false;
  return true;
}

export function toLabelLatex(text: string): string {
  try {
    return expressionLatex(text, []);
  } catch {
    return text;
  }
}

export function renderSvgTextLabel(
  x: number,
  y: number,
  anchor: "middle" | "start" | "end",
  text: string,
  fontSize: number,
  color: string,
  fontFamily: string,
  italic = false,
): string {
  const style = italic ? ' font-style="italic"' : "";
  return `<text x="${round(x)}" y="${round(y)}" text-anchor="${anchor}" font-size="${fontSize}" font-family="${escapeText(fontFamily)}" fill="${color}"${style}>${escapeText(text)}</text>`;
}

export function renderSvgMathLabel(
  x: number,
  y: number,
  anchor: "middle" | "start" | "end",
  latex: string,
  fontSize: number,
  color: string,
  fontFamily: string,
  italic = false,
): string {
  const html = katex.renderToString(latex, { throwOnError: false, displayMode: false });
  const width = Math.max(48, latex.length * fontSize * 0.45 + 12);
  const height = Math.ceil(fontSize * 1.55);
  let foX = x - width / 2;
  if (anchor === "end") foX = x - width;
  if (anchor === "start") foX = x;
  const italicCss = italic ? "font-style:italic;" : "";
  return (
    `<foreignObject x="${round(foX)}" y="${round(y - height * 0.72)}" width="${round(width)}" height="${round(height)}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${fontSize}px;color:${color};${italicCss}` +
    `font-family:${fontFamily};display:flex;align-items:center;justify-content:center;height:100%;">` +
    `<span>${html}</span></div></foreignObject>`
  );
}

export function renderCoordinateLabel(
  x: number,
  y: number,
  display: string,
  latex: string,
  fontSize: number,
  color: string,
  fontFamily: string,
): string {
  if (labelNeedsLatex(display) && latex) {
    return renderSvgMathLabel(x, y, "middle", latex, fontSize, color, "KaTeX_Main, " + fontFamily);
  }
  return renderSvgTextLabel(x, y, "middle", display, fontSize, color, fontFamily);
}
