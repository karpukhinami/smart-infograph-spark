export type AppMode = "free" | "strict";

export interface InfographicStyle {
  id: string;
  name: string;
  shortDescription: string;
  enabled: boolean;
  /** General composition / layout rules for this style. */
  generalRules: string;
  /** Specific element-level rules for this style. */
  specificRules: string;
}

export interface DesignProfile {
  profileName: string;
  colors: {
    pageBackground: string;
    brightAccents: string[];
    pastelFills: string[];
    structural: string[];
  };
  typography: {
    styleId: string;       // id from typography_styles
    specificityId: string; // id from font_specificity_modes
  };
  notesForAI: string;
}

export type InputMode = "text" | "file" | "topic";

export interface SourceText {
  mode: InputMode;
  text: string;
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
