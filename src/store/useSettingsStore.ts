import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import defaultStylesFree from "@/data/default-styles.free.json";
import defaultStylesStrict from "@/data/default-styles.strict.json";
import defaultProfiles from "@/data/default-design-profile.json";

import promptFreeAnalysisWith from "@/data/prompts/free/analysis-with-content.txt?raw";
import promptFreeAnalysisTopic from "@/data/prompts/free/analysis-topic-only.txt?raw";
import promptFreeDesignBrief from "@/data/prompts/free/design-brief.txt?raw";
import promptFreeGeneralRules from "@/data/prompts/free/general-rules.txt?raw";

import promptStrictAnalysisWith from "@/data/prompts/strict/analysis-with-content.txt?raw";
import promptStrictAnalysisTopic from "@/data/prompts/strict/analysis-topic-only.txt?raw";
import promptStrictDesignBrief from "@/data/prompts/strict/design-brief.txt?raw";
import promptStrictGeneralRules from "@/data/prompts/strict/general-rules.txt?raw";
import promptStrictDetectStyle from "@/data/prompts/strict/detect-style.txt?raw";
import promptStrictConnWith from "@/data/prompts/strict/connection-schema-with-content.txt?raw";
import promptStrictConnTopic from "@/data/prompts/strict/connection-schema-topic-only.txt?raw";
import promptConnDesignBrief from "@/data/prompts/simple/design-brief-connection.txt?raw";
import promptStrictConceptWith from "@/data/prompts/strict/concept-art-with-content.txt?raw";
import promptStrictConceptTopic from "@/data/prompts/strict/concept-art-topic-only.txt?raw";
import promptConceptDesignBrief from "@/data/prompts/simple/design-brief-concept-art.txt?raw";
import { AI_LAYOUT_PROMPT } from "@/lib/a4-layout/ai-prompt";

import type { AppMode, DesignProfile, InfographicStyle } from "@/lib/types";

export type UiMode = "debug" | "user";

interface PromptSet {
  analysisWithContent: string;
  analysisTopicOnly: string;
  designBrief: string;
  generalRules: string;
  /** Strict-mode technical layout (AI A4) prompt. */
  codeBasedProduct: string;
  /** Prompt for detecting the best-fitting infographic style. */
  detectStyle: string;
  /** "Схема связей": analysis with source material. */
  connectionSchemaWithContent: string;
  /** "Схема связей": generation from topic only. */
  connectionSchemaTopicOnly: string;
  /** "Схема связей": design-brief prompt (image prompt only, no wireframe). */
  connectionSchemaDesignBrief: string;
  /** "Концепт-арт": analysis with source material. */
  conceptArtWithContent: string;
  /** "Концепт-арт": generation from topic only. */
  conceptArtTopicOnly: string;
  /** "Концепт-арт": design-brief prompt (image prompt only, no wireframe). */
  conceptArtDesignBrief: string;
}

interface SettingsState {
  mode: AppMode;
  setMode: (m: AppMode) => void;

  uiMode: UiMode;
  setUiMode: (m: UiMode) => void;

  promptsByMode: Record<AppMode, PromptSet>;
  setPrompt: (k: keyof PromptSet, v: string) => void;

  stylesByMode: Record<AppMode, InfographicStyle[]>;
  upsertStyle: (s: InfographicStyle) => void;
  toggleStyle: (id: string, enabled: boolean) => void;
  resetStyles: () => void;

  profiles: DesignProfile[];
  upsertProfile: (p: DesignProfile) => void;
  deleteProfile: (name: string) => void;
  resetProfiles: () => void;
}

const initialPrompts: Record<AppMode, PromptSet> = {
  free: {
    analysisWithContent: promptFreeAnalysisWith,
    analysisTopicOnly: promptFreeAnalysisTopic,
    designBrief: promptFreeDesignBrief,
    generalRules: promptFreeGeneralRules,
    codeBasedProduct: "",
    detectStyle: "",
    connectionSchemaWithContent: "",
    connectionSchemaTopicOnly: "",
    connectionSchemaDesignBrief: "",
    conceptArtWithContent: "",
    conceptArtTopicOnly: "",
    conceptArtDesignBrief: "",
  },
  strict: {
    analysisWithContent: promptStrictAnalysisWith,
    analysisTopicOnly: promptStrictAnalysisTopic,
    designBrief: promptStrictDesignBrief,
    generalRules: promptStrictGeneralRules,
    codeBasedProduct: AI_LAYOUT_PROMPT,
    detectStyle: promptStrictDetectStyle,
    connectionSchemaWithContent: promptStrictConnWith,
    connectionSchemaTopicOnly: promptStrictConnTopic,
    connectionSchemaDesignBrief: promptConnDesignBrief,
    conceptArtWithContent: promptStrictConceptWith,
    conceptArtTopicOnly: promptStrictConceptTopic,
    conceptArtDesignBrief: promptConceptDesignBrief,
  },
};

const initialStyles: Record<AppMode, InfographicStyle[]> = {
  free: defaultStylesFree as InfographicStyle[],
  strict: defaultStylesStrict as InfographicStyle[],
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mode: "strict",
      setMode: (m) => set({ mode: m }),

      uiMode: "debug",
      setUiMode: (m) => set({ uiMode: m }),

      promptsByMode: initialPrompts,
      setPrompt: (k, v) =>
        set((s) => ({
          promptsByMode: {
            ...s.promptsByMode,
            [s.mode]: { ...s.promptsByMode[s.mode], [k]: v },
          },
        })),

      stylesByMode: initialStyles,
      upsertStyle: (style) =>
        set((s) => {
          const list = s.stylesByMode[s.mode];
          const next = list.some((x) => x.id === style.id)
            ? list.map((x) => (x.id === style.id ? style : x))
            : [...list, style];
          return { stylesByMode: { ...s.stylesByMode, [s.mode]: next } };
        }),
      toggleStyle: (id, enabled) =>
        set((s) => ({
          stylesByMode: {
            ...s.stylesByMode,
            [s.mode]: s.stylesByMode[s.mode].map((x) => (x.id === id ? { ...x, enabled } : x)),
          },
        })),
      resetStyles: () =>
        set((s) => ({
          stylesByMode: { ...s.stylesByMode, [s.mode]: initialStyles[s.mode] },
        })),

      profiles: defaultProfiles as DesignProfile[],
      upsertProfile: (p) =>
        set((s) => ({
          profiles: s.profiles.some((x) => x.profileName === p.profileName)
            ? s.profiles.map((x) => (x.profileName === p.profileName ? p : x))
            : [...s.profiles, p],
        })),
      deleteProfile: (name) =>
        set((s) => ({ profiles: s.profiles.filter((p) => p.profileName !== name) })),
      resetProfiles: () => set({ profiles: defaultProfiles as DesignProfile[] }),
    }),
    {
      name: "infographic-settings",
      version: 29,

      // Breaking shape change — drop persisted state from older versions.
      migrate: () => undefined as unknown as SettingsState,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);

/** Convenience selector for current-mode prompts. */
export function useCurrentPrompts(): PromptSet {
  return useSettingsStore((s) => s.promptsByMode[s.mode]);
}
/** Convenience selector for current-mode styles. */
export function useCurrentStyles(): InfographicStyle[] {
  return useSettingsStore((s) => s.stylesByMode[s.mode]);
}
