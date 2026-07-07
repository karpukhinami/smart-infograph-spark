export interface AICardResult {
  cardId: number;
  title: string;
  content: string;
  addendums: {
    placement?: string;
    layout?: string;
    items?: unknown;
  };
  attention?: string;
}

export interface AILayoutResult {
  cards: AICardResult[];
  layout: {
    rows: Array<{ cards: Array<{ cardId: number; width: string | number }> }>;
  };
}

export function extractAIJson(text: string): unknown[] {
  const clean = String(text || "").replace(/```json|```/gi, "").trim();
  const objects: unknown[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    }
    if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          objects.push(JSON.parse(clean.slice(start, i + 1)));
        } catch {
          /* skip malformed */
        }
        start = -1;
      }
    }
  }
  return objects;
}

export function normalizeAIResponse(raw: string): AILayoutResult {
  const parts = extractAIJson(raw);
  const cardsPart = parts.find(
    (x): x is { cards: AICardResult[] } =>
      typeof x === "object" && x !== null && Array.isArray((x as { cards?: unknown }).cards),
  );
  const layoutPart = parts.find(
    (x): x is { layout: AILayoutResult["layout"] } =>
      typeof x === "object" &&
      x !== null &&
      typeof (x as { layout?: unknown }).layout === "object" &&
      Array.isArray((x as { layout: { rows?: unknown } }).layout?.rows),
  );
  if (!cardsPart || !layoutPart) {
    throw new Error("AI response must contain two JSON objects: cards and layout");
  }
  return { cards: cardsPart.cards, layout: layoutPart.layout };
}

export function parseAIWidth(value: string | number): number {
  if (typeof value === "number" && value > 0) return value;
  const text = String(value || "").trim();
  if (/^\d+(?:\.\d+)?%$/.test(text)) return Number(text.slice(0, -1)) / 100;
  if (text.includes("/")) {
    const parts = text.split("/").map(Number);
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
  }
  return Number(text) || 0;
}

export function normalizeAIRowsForRender(
  rows: AILayoutResult["layout"]["rows"],
  totalCards: number,
): Array<{ cards: Array<{ cardId: number; width: number; fraction: number }> }> {
  if (!Array.isArray(rows)) throw new Error("AI layout.rows is missing");

  const flat = rows.flatMap((row) => row.cards || []);
  const ids = flat.map((c) => Number(c.cardId));
  const expected = Array.from({ length: totalCards }, (_, i) => i + 1);
  const sorted = ids.slice().sort((a, b) => a - b);
  if (sorted.length !== expected.length || sorted.some((id, i) => id !== expected[i])) {
    throw new Error("AI layout must contain every cardId exactly once");
  }
  if (ids.some((id, i) => id !== expected[i])) {
    throw new Error(
      "AI layout changed card order. Card order must stay 1, 2, 3…; only row breaks and widths may change.",
    );
  }

  return rows.map((row, rowIndex) => {
    const sourceCards = (row.cards || []).slice(0, 4);
    if (!sourceCards.length) throw new Error(`AI row ${rowIndex + 1} is empty`);
    if ((row.cards || []).length > 4) throw new Error(`AI row ${rowIndex + 1} has more than 4 cards`);

    const cards = sourceCards.map((c) => {
      const cardId = Number(c.cardId);
      const width = parseAIWidth(c.width);
      if (!(width > 0)) throw new Error(`AI row ${rowIndex + 1}, card ${cardId}: invalid width`);
      return { cardId, width };
    });

    const total = cards.reduce((sum, c) => sum + c.width, 0);
    if (Math.abs(total - 1) > 0.02) {
      throw new Error(`AI row ${rowIndex + 1}: widths must sum to 1, got ${Math.round(total * 1000) / 1000}`);
    }

    return { cards: cards.map((c) => ({ ...c, fraction: c.width / total })) };
  });
}
