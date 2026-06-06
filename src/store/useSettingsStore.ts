import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import defaultStyles from "@/data/default-styles.json";
import defaultProfile from "@/data/default-design-profile.json";
import promptAnalysisWith from "@/data/prompts/analysis-with-content.txt?raw";
import promptAnalysisTopic from "@/data/prompts/analysis-topic-only.txt?raw";
import promptDesignBrief from "@/data/prompts/design-brief.txt?raw";
import type { DesignProfile, InfographicStyle } from "@/lib/types";

interface SettingsState {
  prompts: {
    analysisWithContent: string;
    analysisTopicOnly: string;
    designBrief: string;
  };
  styles: InfographicStyle[];
  profiles: DesignProfile[];
  setPrompt: (k: keyof SettingsState["prompts"], v: string) => void;
  upsertStyle: (s: InfographicStyle) => void;
  toggleStyle: (id: string, enabled: boolean) => void;
  resetStyles: () => void;
  upsertProfile: (p: DesignProfile) => void;
  deleteProfile: (name: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      prompts: {
        analysisWithContent: promptAnalysisWith,
        analysisTopicOnly: promptAnalysisTopic,
        designBrief: promptDesignBrief,
      },
      styles: defaultStyles as InfographicStyle[],
      profiles: [defaultProfile as DesignProfile],
      setPrompt: (k, v) => set((s) => ({ prompts: { ...s.prompts, [k]: v } })),
      upsertStyle: (s) =>
        set((state) => ({
          styles: state.styles.some((x) => x.id === s.id)
            ? state.styles.map((x) => (x.id === s.id ? s : x))
            : [...state.styles, s],
        })),
      toggleStyle: (id, enabled) =>
        set((state) => ({
          styles: state.styles.map((x) => (x.id === id ? { ...x, enabled } : x)),
        })),
      resetStyles: () => set({ styles: defaultStyles as InfographicStyle[] }),
      upsertProfile: (p) =>
        set((state) => ({
          profiles: state.profiles.some((x) => x.profileName === p.profileName)
            ? state.profiles.map((x) => (x.profileName === p.profileName ? p : x))
            : [...state.profiles, p],
        })),
      deleteProfile: (name) =>
        set((state) => ({ profiles: state.profiles.filter((p) => p.profileName !== name) })),
    }),
    {
      name: "infographic-settings",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
