/** Strip disallowed tags/attributes from model-returned HTML (browser only). */
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
