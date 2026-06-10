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
    styleId: string;
    specificityId: string;
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

/** Structured analysis JSON produced by the strict-mode analysis prompt. */
export interface AnalysisEntity {
  sectionId: number;
  entityType: string;
  title: string | null;
  content: string | string[];
  formula?: string | string[] | null;
  example?: string | string[] | null;
  icon?: string | null;
  visual?: { type: string; description: string } | null;
  priority?: "high" | "medium" | "low";
}
export interface AnalysisJson {
  sourceMode: "text" | "topic";
  topic: string;
  subject: string | null;
  grade: string | null;
  summary: string;
  entities: AnalysisEntity[];
  warnings: string[];
}

export interface ContentSummary {
  /** Human-readable text shown to the user (rendered from analysis JSON in strict mode). */
  content: string;
  /** Style id recommended by the model (or chosen by fallback). */
  recommendedStyle: string;
  /** Structured analysis JSON (strict mode). */
  analysis?: AnalysisJson | null;
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
