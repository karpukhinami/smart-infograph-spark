import type { DesignProfile, DesignProfileColors, InfographicStyle } from "./types";
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

const COLOR_ROLE_LABELS: Array<{ key: keyof DesignProfileColors; label: string }> = [
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

// Original free-mode prose; preserved for the free style design brief.
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

// English-only "use for" descriptions for the strict-mode LAYER 1 block.
const COLOR_USE_FOR: Record<keyof DesignProfileColors, string> = {
  backgroundColor: "use for the overall page / canvas background",
  surfaceColor: "use for small inner surfaces and insets inside cards (formulas, examples, notes, mini explanations)",
  primaryColor: "use for the main semantic accent of the infographic and one key word in the main title",
  detailSoftColor: "use for soft background fills of secondary content zones (lighter variant)",
  detailDeepColor: "use for soft background fills of secondary content zones (deeper variant)",
  contrastSoftColor: "use for a separate emphasized content zone (conclusion, consequence, quote, mnemonic, warning, key takeaway)",
  inkColor: "use for main educational text, labels, formulas, captions, icons, lines, arrows, outlines and other technical graphic elements",
  headerColor: "use for the dark header background and for card title plates",
  lightTextColor: "use for the main title text on the dark header and for text on dark plates",
  spotAccentColor: "use only for rare micro-accents (one word, small icon, marker, warning sign); max ~2 uses per infographic",
  mutedheaderTextColor: "use for subtitles, meta labels and secondary text inside the dark header",
};

const FONT_FAMILY_PLACEHOLDER = "[FONT_FAMILY_PLACEHOLDER]";

function layer1RulesTemplate(): string {
  // Body uses {{role}} markers; substituted with hex codes from the active palette.
  return `1. PAGE BACKGROUND & GLOBAL SYSTEM

- Use {{backgroundColor}} for the full canvas background.

- All spacing between cards must visually expose {{backgroundColor}}, reinforcing grid structure.

- No other background colors may replace or override {{backgroundColor}} outside cards.

- Use ${FONT_FAMILY_PLACEHOLDER} as the single typographic system.

- Global text color rule:

- Default text color is {{inkColor}} for all educational content.


2. TITLE CARD (HEADER AREA) COLORING RULES

- Card background: {{headerColor}}

- Title text:

- Color: {{lightTextColor}}

- Style: VERY BOLD, UPPERCASE, max 2 lines

- Optional: one key word may use {{primaryColor}} if semantically important; will be specified in the title card description in LAYER 3

- Meta pill (subject + grade):

- Background: {{headerColor}}

- Text color: {{mutedheaderTextColor}}

- Style: UPPERCASE, increased letter spacing

- Separator: small dot "•"

- Position: top-right corner of title card

- Summary text:

- Color: {{mutedheaderTextColor}}

- Style: sentence case, regular weight

- {{spotAccentColor}} may be used for a single word or phrase; if used, it will be specified in the title card description

- Color accents in title card text must not affect full sentences or structural elements


CARD COLORING RULES

- Normal content and card inset text color: {{inkColor}} if contrast allows; usage of {{lightTextColor}} will be specified in the card description, but should be additionally judged anyway.

- Use background color specified in the card description.


3. Card title should use these styling rules:

- Title plate background: {{headerColor}}

- Title plate text: {{lightTextColor}}

- Typography: UPPERCASE, BOLD

- Must be visually consistent across all cards

- No decorative variation between same-level cards

- Exception:

- Core card may use plain large heading without title plate if readability is improved


4. TEXT CONTENT RULES (INSIDE CARDS)

- Main content:

- Always {{inkColor}}

- Emphasis rules:

- Bold allowed only for semantic highlighting

- {{spotAccentColor}} allowed only for single-word micro emphasis and will be specified in the card description

- Typography:

- Body: sentence case, regular weight


5. CONTENT INSETS

- Content insets are internal zones inside a card

- Background: {{surfaceColor}}

- Text inside inset: {{inkColor}}

- Typography: sentence case, regular weight

- Layout inside the card will be specified in the card description

- Must remain typographically consistent with main system font


6. ICONS & DIAGRAM ELEMENTS

- Icon color: {{inkColor}}

- Icons must be outline-style, minimal, and consistent stroke weight

- Icons must never use pastel colors

- Position rules:

- Icons may appear above title, next to title, or aligned with section headers

- Icons must not displace main content hierarchy

- Visual / diagrams:

- Must inherit card background (core/normal/accent rules) if not specified that it is placed inside a content inset

- Lines, arrows, labels: always {{inkColor}}

- No decorative or non-semantic visual elements allowed


9. MINI-ITEM BLOCKS (LIST / ALGORITHM COMPRESSION)

- Used only for:

- factList

- actionList

- algorithmStep sequences when compact representation is needed

- Structure:

- pictogram/icon + short text label

- Rules:

- Background: same as parent card (no new color layer)

- Text color: {{inkColor}}

- Icon color: {{inkColor}}

- Must NOT use {{surfaceColor}}, {{detailSoftColor}}, or {{contrastSoftColor}} as separate blocks

- Must NOT be treated as inset or separate card

- Placement:

- Can be arranged in rows or grids inside a card

- Must preserve reading order


10. GLOBAL CONSTRAINTS

- Never introduce colors outside specified palette.

- Never output technical variables or HEX codes in final visible design

- Never break consistency of typographic system

- Never allow decorative elements not specified in the card description

- Never let non-core elements visually compete with core card`;
}

export function designProfileColorsAndRules(profile: DesignProfile | null | undefined): string {
  if (!profile) return "(design profile is not set)";
  const c = profile.colors;
  const typoStyle = TYPO_STYLES.find((t) => t.id === profile.typography.styleId);

  const lines: string[] = [];
  lines.push("LAYER 1 -- COLOR AND TYPOGRAPHY GENERAL RULES");
  lines.push("");
  lines.push("PALETTE AND FONT:");
  for (const { key } of COLOR_ROLE_LABELS) {
    const hex = c?.[key];
    if (!hex) continue;
    const useFor = COLOR_USE_FOR[key];
    lines.push(`- ${useFor}: ${hex} (${key}).`);
  }
  if (typoStyle) {
    lines.push("");
    lines.push(typoStyle.prompt);
  }
  lines.push("");

  // Substitute role placeholders with hex codes; if a role is missing in palette, keep the role
  // name in plain text as a safe fallback (it stays visible only inside the prompt, never in image).
  let body = layer1RulesTemplate();
  for (const { key } of COLOR_ROLE_LABELS) {
    const hex = c?.[key];
    const replacement = hex ?? `(${key})`;
    body = body.replaceAll(`{{${key}}}`, replacement);
  }
  // Font family: keep placeholder text since concrete family isn't pinned by the profile.
  lines.push(body);

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
    .replaceAll("{{DESIGN_PROFILE_COLORS_AND_RULES}}", designProfileColorsAndRules(profile))
    .replaceAll("{{USER_WISHES}}", userWishes.trim() || "(нет)")
    .replaceAll("{{GENERAL_RULES_BLOCK}}", generalRules?.trim() ?? "");
}
