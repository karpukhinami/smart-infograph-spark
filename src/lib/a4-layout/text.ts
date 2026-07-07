export function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function flattenText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(flattenText).join("\n");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Plain text for line-count estimates when content may contain HTML. */
export function stripHtmlTags(text: string): string {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function textStats(value: unknown) {
  const items = asArray(value).map((v) => flattenText(v)).filter(Boolean);
  const text = items.join("\n");
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const maxWord = words.reduce((m, w) => Math.max(m, w.length), 0);
  const maxItem = items.reduce((m, it) => Math.max(m, it.length), 0);
  return { items, text, chars: text.length, itemCount: items.length, maxWord, maxItem };
}

export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>'"]/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch] as string,
  );
}
