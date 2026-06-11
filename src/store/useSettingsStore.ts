import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import defaultStylesFree from "@/data/default-styles.free.json";
import defaultStylesStrict from "@/data/default-styles.strict.json";
import defaultProfile from "@/data/default-design-profile.json";

import promptFreeAnalysisWith from "@/data/prompts/free/analysis-with-content.txt?raw";
import promptFreeAnalysisTopic from "@/data/prompts/free/analysis-topic-only.txt?raw";
import promptFreeDesignBrief from "@/data/prompts/free/design-brief.txt?raw";
import promptFreeGeneralRules from "@/data/prompts/free/general-rules.txt?raw";

import promptStrictAnalysisWith from "@/data/prompts/strict/analysis-with-content.txt?raw";
import promptStrictAnalysisTopic from "@/data/prompts/strict/analysis-topic-only.txt?raw";
import promptStrictDesignBrief from "@/data/prompts/strict/design-brief.txt?raw";
import promptStrictGeneralRules from "@/data/prompts/strict/general-rules.txt?raw";

import type { AppMode, DesignProfile, InfographicStyle } from "@/lib/types";

interface PromptSet {
  analysisWithContent: string;
  analysisTopicOnly: string;
  designBrief: string;
  generalRules: string;
}

interface SettingsState {
  mode: AppMode;
  setMode: (m: AppMode) => void;

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
  },
  strict: {
    analysisWithContent: promptStrictAnalysisWith,
    analysisTopicOnly: promptStrictAnalysisTopic,
    designBrief: promptStrictDesignBrief,
    generalRules: promptStrictGeneralRules,
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

      profiles: [defaultProfile as DesignProfile],
      upsertProfile: (p) =>
        set((s) => ({
          profiles: s.profiles.some((x) => x.profileName === p.profileName)
            ? s.profiles.map((x) => (x.profileName === p.profileName ? p : x))
            : [...s.profiles, p],
        })),
      deleteProfile: (name) =>
        set((s) => ({ profiles: s.profiles.filter((p) => p.profileName !== name) })),
      resetProfiles: () => set({ profiles: [defaultProfile as DesignProfile] }),
    }),
    {
      name: "infographic-settings",
      version: 14,
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
