import composeTemplate from "@/data/prompts/workspace/compose-source-text.txt?raw";

export interface ComposeTextInput {
  topic?: string | null;
  subject?: string | null;
  grade?: string | null;
  instructions?: string | null;
}

function orDash(value?: string | null): string {
  const v = (value ?? "").trim();
  return v || "(не указано)";
}

export function buildComposeTextPrompt(input: ComposeTextInput): string {
  return composeTemplate
    .replace("{{TOPIC}}", orDash(input.topic))
    .replace("{{SUBJECT}}", orDash(input.subject))
    .replace("{{GRADE}}", orDash(input.grade))
    .replace("{{INSTRUCTIONS}}", orDash(input.instructions));
}

/** Cleans typical model formatting slips: code fences and non-dollar LaTeX delimiters. */
export function normalizeComposedText(raw: string): string {
  let text = (raw ?? "").trim();
  if (!text) return "";
  text = text
    .replace(/^```(?:markdown|md|latex|text)?\s*\n/i, "")
    .replace(/\n```\s*$/i, "");
  text = text
    .replace(/```math\s*([\s\S]*?)```/g, (_m, body: string) => `$$${String(body).trim()}$$`)
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_m, body: string) => `$$${String(body).trim()}$$`)
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_m, body: string) => `$${String(body).trim()}$`);
  return text.trim();
}
