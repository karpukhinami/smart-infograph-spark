// Strict JSON parse with cleanup for LLM outputs.
export function extractJson<T = unknown>(raw: string): T {
  if (!raw) throw new Error("Empty model response");
  let s = raw.trim();
  // strip markdown fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // grab outermost {...}
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  try {
    return JSON.parse(s) as T;
  } catch {
    try {
      const cleaned = s.replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(cleaned) as T;
    } catch {
      // Most common LLM bug: unescaped backslashes inside JSON strings
      // (LaTeX like \frac, \sqrt, \Delta). Re-escape any backslash that is
      // NOT followed by a valid JSON escape char ( " \ / b f n r t u ).
      const fixed = s
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
      return JSON.parse(fixed) as T;
    }
  }
}
