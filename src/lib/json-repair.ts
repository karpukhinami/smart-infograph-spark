const VALID_JSON_ESCAPES = new Set(["\"", "\\", "/", "b", "f", "n", "r", "t", "u"]);

function normalizeWrapper(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
}

function looksLikeJsonString(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function parseCandidate<T>(candidate: string): T {
  const parsed = JSON.parse(candidate) as unknown;
  if (typeof parsed === "string" && looksLikeJsonString(parsed)) {
    return extractJson<T>(parsed);
  }
  return parsed as T;
}

function isLikelyJsonStart(char: string): boolean {
  return char === "{" || char === "[";
}

function findJsonCandidate(text: string): string | null {
  let start = -1;
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (start === -1) {
      if (isLikelyJsonStart(ch)) {
        start = i;
        stack.push(ch);
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }

    if (ch === "}" || ch === "]") {
      const last = stack.at(-1);
      if ((ch === "}" && last === "{") || (ch === "]" && last === "[")) {
        stack.pop();
        if (!stack.length) {
          return text.slice(start, i + 1);
        }
      }
    }
  }

  if (start !== -1) return text.slice(start);
  return null;
}

function isTruncatedJson(text: string): boolean {
  const s = text.trim();
  if (!s) return false;

  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    if (ch === "}" || ch === "]") stack.pop();
  }

  return inString || escaped || stack.length > 0 || /[,:\\]$/.test(s) || /\.\.\.$|\u2026$|\[truncated\]/i.test(s);
}

function removeTrailingCommas(text: string): string {
  return text.replace(/,(\s*[}\]])/g, "$1");
}

function repairJsonText(text: string): string {
  let out = "";
  let inString = false;

  const nextSignificantChar = (from: number): string => {
    for (let i = from; i < text.length; i += 1) {
      const ch = text[i];
      if (!/\s/.test(ch)) return ch;
    }
    return "";
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
        out += ch;
        continue;
      }
      if ((ch === "\n" || ch === "\r" || ch === "\t") && !out.trim()) continue;
      if (ch < " " && ch !== "\n" && ch !== "\r" && ch !== "\t") continue;
      out += ch;
      continue;
    }

    if (ch === "\\") {
      const next = text[i + 1];
      if (!next) {
        out += "\\\\";
        continue;
      }
      if (VALID_JSON_ESCAPES.has(next)) {
        out += `\\${next}`;
        i += 1;
        continue;
      }
      out += `\\\\${next}`;
      i += 1;
      continue;
    }

    if (ch === '"') {
      const next = nextSignificantChar(i + 1);
      if (next && ![",", ":", "}", "]"].includes(next)) {
        out += "\\\"";
        continue;
      }
      inString = false;
      out += ch;
      continue;
    }

    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") {
      out += "\\n";
      continue;
    }
    if (ch === "\t") {
      out += "\\t";
      continue;
    }

    out += ch;
  }

  return out;
}

// Strict JSON parse with cleanup for LLM outputs.
export function extractJson<T = unknown>(raw: string): T {
  if (!raw) throw new Error("Empty model response");

  const normalized = normalizeWrapper(raw);
  const candidate = findJsonCandidate(normalized) ?? normalized;

  if (isTruncatedJson(candidate)) {
    throw new Error("Truncated JSON output from model");
  }

  const attempts = [
    candidate,
    removeTrailingCommas(candidate),
    repairJsonText(candidate),
    removeTrailingCommas(repairJsonText(candidate)),
  ];

  let lastError: unknown;
  for (const attempt of [...new Set(attempts)]) {
    try {
      return parseCandidate<T>(attempt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to parse JSON response");
}
