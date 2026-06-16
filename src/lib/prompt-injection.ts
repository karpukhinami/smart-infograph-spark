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

const COLOR_ROLE_LABELS: Array<{ key: keyof import("./types").DesignProfileColors; label: string }> = [
  { key: "backgroundColor", label: "Задний фон (backgroundColor)" },
  { key: "surfaceColor", label: "Светлый фон плашки внутри карточки (surfaceColor)" },
  { key: "primaryColor", label: "Акцентный цвет палитры (primaryColor)" },
  { key: "detailSoftColor", label: "Более светлая пастель (detailSoftColor)" },
  { key: "detailDeepColor", label: "Более тёмная пастель (detailDeepColor)" },
  { key: "contrastSoftColor", label: "Контрастная пастель (contrastSoftColor)" },
  { key: "inkColor", label: "Цвет тёмного текста и технических линий (inkColor)" },
  { key: "headerColor", label: "Цвет шапки и фона заголовков (headerColor)" },
  { key: "lightTextColor", label: "Цвет светлого текста (lightTextColor)" },
  { key: "spotAccentColor", label: "Цвет акцентных деталей (spotAccentColor)" },
  { key: "mutedheaderTextColor", label: "Вторичный светлый текст в шапке (mutedheaderTextColor)" },
];

export function designProfileProse(profile: DesignProfile | null | undefined): string {
  if (!profile) return "(дизайн-профиль не задан)";
  const c = profile.colors;
  const typoStyle = TYPO_STYLES.find((t) => t.id === profile.typography.styleId);
  const typoSpec = TYPO_SPECIFICITY.find((t) => t.id === profile.typography.specificityId);

  const lines: string[] = [];
  lines.push(
    "Используй только цвета из палитры дизайн-профиля, опираясь на роли каждого цвета.",
  );
  lines.push(`Профиль: ${profile.profileName}.`);
  lines.push("Палитра по ролям:");
  for (const { key, label } of COLOR_ROLE_LABELS) {
    const hex = c?.[key];
    if (hex) lines.push(`- ${label}: ${hex}.`);
  }

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
  generalRules?: string;
}): string {
  const { template, contentSummary, style, profile, userWishes, generalRules } = opts;
  return template
    .replaceAll("{{CONTENT_SUMMARY}}", contentSummary)
    .replaceAll("{{STYLE_NAME}}", style?.name ?? "")
    .replaceAll("{{STYLE_DESCRIPTION}}", style?.shortDescription ?? "")
    .replaceAll("{{STYLE_GENERAL_RULES_BLOCK}}", styleGeneralRulesBlock(style))
    .replaceAll("{{STYLE_SPECIFIC_RULES_BLOCK}}", styleSpecificRulesBlock(style))
    .replaceAll("{{DESIGN_PROFILE_PROSE}}", designProfileProse(profile))
    .replaceAll("{{USER_WISHES}}", userWishes.trim() || "(нет)")
    .replaceAll("{{GENERAL_RULES_BLOCK}}", generalRules?.trim() ?? "");
}
