export interface InfographicStyle {
  id: string;
  name: string;
  shortDescription: string;
  enabled: boolean;
  rules: {
    composition: string;
    symmetry: string;
    primaryCarrier: string;
    colorApproach: string;
    typography: string;
    illustration: string;
    character: string;
  };
}

export interface DesignProfile {
  profileName: string;
  background: string;
  accents: {
    primary: string;
    secondary: string;
    additional: string[];
  };
  fonts: {
    primary: { family: string; weights: string[] };
    secondary: { family: string; weights: string[] };
  };
  usageRules: {
    primaryAccent: string[];
    secondaryAccent: string[];
    additionalAccents: string[];
  };
  cardStyle: { borderRadius: string; border: string; shadow: string };
  spacing: { padding: string; interBlockGap: string };
  notesForAI: string;
}

export type InputMode = "text" | "file" | "topic";

export interface SourceText {
  mode: InputMode;
  text: string; // text or file contents
  topic?: string;
  subject?: string;
  grade?: string;
  userInstructions: string;
}

export interface WireframeBlock {
  label: string;
  type: string;
  width: number;
  note?: string;
}
export interface WireframeRow {
  blocks: WireframeBlock[];
}
export interface WireframeDescription {
  title: string;
  mainVisual?: string;
  rows: WireframeRow[];
  connections?: Array<{ from: string; to: string; kind: string }>;
}

export interface ContentSummary {
  content: string;
  recommendedStyle: string;
}

export interface DesignBriefResult {
  PromptForImageGeneration: string;
  WireframeDescription: WireframeDescription;
}

export type PaneMode = "content" | "wireframe" | "image";

export interface Versioned<T> {
  id: string;
  createdAt: number;
  value: T;
}
