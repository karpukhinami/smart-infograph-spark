/**
 * Strip disallowed tags/attributes from model-returned HTML (browser only).
 *
 * Allowed tags: p, br, b, ul, ol, li, span.accent.
 * Lists: ul/ol/li render as bulleted or numbered lists; use them when content is list-like.
 * span.accent: inline highlight for a single word or short phrase only — not whole sentences.
 */
export function sanitizeAIHtml(html: string): string {
  const source = String(html || "");
  if (typeof document === "undefined") return source;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = source;
  const allowed = new Set(["P", "BR", "B", "UL", "OL", "LI", "SPAN"]);

  wrapper.querySelectorAll("*").forEach((el) => {
    if (!allowed.has(el.tagName)) {
      el.replaceWith(...Array.from(el.childNodes));
    } else {
      Array.from(el.attributes).forEach((attr) => {
        if (!(el.tagName === "SPAN" && attr.name === "class" && attr.value === "accent")) {
          el.removeAttribute(attr.name);
        }
      });
    }
  });

  return wrapper.innerHTML;
}
