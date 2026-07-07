import { asArray, escapeHtml, flattenText } from "@/lib/a4-layout/text";

/** Final card body HTML for AI input (escaped, as shown on the mechanical layout). */
export function entityContentToInputHtml(content: unknown, numbered = false): string {
  const arr = asArray(content).map((v) => flattenText(v)).filter(Boolean);
  if (!arr.length) return "";
  if (Array.isArray(content)) {
    const tag = numbered ? "ol" : "ul";
    return `<${tag}>${arr.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
  }
  return arr
    .join("\n\n")
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
