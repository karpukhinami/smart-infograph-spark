import type { DesignProfile, InfographicStyle } from "./types";
import typographyOptions from "@/data/typography-options.json";

interface TypoOption { id: string; label: string; prompt: string }
const TYPO_STYLES = typographyOptions.typography_styles as TypoOption[];
const TYPO_SPECIFICITY = typographyOptions.font_specificity_modes as TypoOption[];

export function styleGeneralRulesBlock(style: InfographicStyle | null | undefined): string {
  const text = (style?.generalRules ?? "").trim();
  if (!text) return "";
  return `Размещая информацию на постере, придерживайся следующих общих правил:\n${text}`;
}

export function styleSpecificRulesBlock(style: InfographicStyle | null | undefined): string {
  const text = (style?.specificRules ?? "").trim();
  if (!text) return "";
  return `При оформлении отдельных элементов руководствуйся следующими принципами:\n${text}`;
}

function listColors(label: string, colors: string[]): string {
  const cleaned = colors.filter(Boolean);
  if (!cleaned.length) return "";
  return `${label}: ${cleaned.join(", ")}`;
}

export function designProfileProse(profile: DesignProfile | null | undefined): string {
  if (!profile) return "(дизайн-профиль не задан)";
  const c = profile.colors;
  const typoStyle = TYPO_STYLES.find((t) => t.id === profile.typography.styleId);
  const typoSpec = TYPO_SPECIFICITY.find((t) => t.id === profile.typography.specificityId);

  const lines: string[] = [];
  lines.push(
    "Используй только цвета из предложенных вариантов, опираясь на правила стиля и на содержание инфографики.",
  );
  if (c.pageBackground) lines.push(`Фон страницы (page background): ${c.pageBackground}.`);
  if (c.brightAccents?.length)
    lines.push(`Яркие акценты (для ключевых слов, иконок, выделений): ${c.brightAccents.join(", ")}.`);
  if (c.pastelFills?.length)
    lines.push(`Пастельные заливки (только для фонов карточек, никогда для текста): ${c.pastelFills.join(", ")}.`);
  if (c.structural?.length)
    lines.push(`Технические/структурные цвета (графит, тёмные плашки, фон, серый текст): ${c.structural.join(", ")}.`);

  if (typoStyle) {
    lines.push("");
    lines.push(`Типографика — ${typoStyle.label}. ${typoStyle.prompt}`);
  }
  if (typoSpec) {
    lines.push(`Режим выбора шрифта — ${typoSpec.label}. ${typoSpec.prompt}`);
  }

  if (profile.notesForAI?.trim()) {
    lines.push("");
    lines.push("Следуй этим правилам при использовании цветов на инфографике:");
    lines.push(profile.notesForAI.trim());
  }

  return lines.join("\n");
}

export function buildDesignBriefPrompt(opts: {
  template: string;
  contentSummary: string;
  style: InfographicStyle | null | undefined;
  profile: DesignProfile | null | undefined;
  userWishes: string;
}): string {
  const { template, contentSummary, style, profile, userWishes } = opts;
  return template
    .replaceAll("{{CONTENT_SUMMARY}}", contentSummary)
    .replaceAll("{{STYLE_NAME}}", style?.name ?? "")
    .replaceAll("{{STYLE_DESCRIPTION}}", style?.shortDescription ?? "")
    .replaceAll("{{STYLE_GENERAL_RULES_BLOCK}}", styleGeneralRulesBlock(style))
    .replaceAll("{{STYLE_SPECIFIC_RULES_BLOCK}}", styleSpecificRulesBlock(style))
    .replaceAll("{{DESIGN_PROFILE_PROSE}}", designProfileProse(profile))
    .replaceAll("{{USER_WISHES}}", userWishes.trim() || "(нет)");
}
