import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ContentSummary,
  DesignBriefResult,
  SourceText,
  Versioned,
} from "@/lib/types";
import type { ProgrammaticRenderSpec } from "@/lib/render-spec/types";
import { DEFAULT_IMAGE_MODEL, DEFAULT_TEXT_MODEL } from "@/lib/models";

export type BriefMode = "design" | "programmatic";

function v<T>(value: T): Versioned<T> {
  return { id: crypto.randomUUID(), createdAt: Date.now(), value };
}

interface ProjectState {
  source: SourceText;
  setSource: (patch: Partial<SourceText>) => void;
  resetProject: () => void;

  contentVersions: Versioned<ContentSummary>[];
  activeContentId: string | null;
  pushContent: (c: ContentSummary) => void;
  updateActiveContent: (text: string) => void;
  setActiveContent: (id: string) => void;

  selectedStyleId: string | null;
  setSelectedStyleId: (id: string) => void;
  selectedProfileName: string | null;
  setSelectedProfileName: (n: string) => void;

  briefMode: BriefMode;
  setBriefMode: (m: BriefMode) => void;

  briefVersions: Versioned<DesignBriefResult>[];
  activeBriefId: string | null;
  pushBrief: (b: DesignBriefResult) => void;
  updateActiveBriefPrompt: (prompt: string) => void;
  setActiveBrief: (id: string) => void;
  userWishes: string;
  setUserWishes: (s: string) => void;

  specVersions: Versioned<ProgrammaticRenderSpec>[];
  activeSpecId: string | null;
  pushSpec: (s: ProgrammaticRenderSpec) => void;
  setActiveSpec: (id: string) => void;

  imageVersions: Versioned<string>[]; // data URLs
  activeImageId: string | null;
  pushImage: (dataUrl: string) => void;
  setActiveImage: (id: string) => void;

  models: { analysis: string; brief: string; image: string };
  setModel: (k: "analysis" | "brief" | "image", id: string) => void;
}

const initialSource: SourceText = {
  mode: "text",
  text: "",
  topic: "",
  subject: "",
  grade: "",
  userInstructions: "",
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      source: initialSource,
      setSource: (patch) => set((s) => ({ source: { ...s.source, ...patch } })),
      resetProject: () =>
        set({
          source: initialSource,
          contentVersions: [],
          activeContentId: null,
          selectedStyleId: null,
          selectedProfileName: null,
          briefVersions: [],
          activeBriefId: null,
          briefMode: "design",
          specVersions: [],
          activeSpecId: null,
          userWishes: "",
          imageVersions: [],
          activeImageId: null,
        }),

      contentVersions: [],
      activeContentId: null,
      pushContent: (c) => {
        const ver = v(c);
        set((s) => ({
          contentVersions: [...s.contentVersions, ver],
          activeContentId: ver.id,
          selectedStyleId: s.selectedStyleId ?? c.recommendedStyle,
        }));
      },
      updateActiveContent: (text) =>
        set((s) => ({
          contentVersions: s.contentVersions.map((x) =>
            x.id === s.activeContentId ? { ...x, value: { ...x.value, content: text } } : x,
          ),
        })),
      setActiveContent: (id) => set({ activeContentId: id }),

      selectedStyleId: null,
      setSelectedStyleId: (id) => set({ selectedStyleId: id }),
      selectedProfileName: null,
      setSelectedProfileName: (n) => set({ selectedProfileName: n }),

      briefVersions: [],
      activeBriefId: null,
      pushBrief: (b) => {
        const ver = v(b);
        set((s) => ({ briefVersions: [...s.briefVersions, ver], activeBriefId: ver.id }));
      },
      updateActiveBriefPrompt: (prompt) =>
        set((s) => ({
          briefVersions: s.briefVersions.map((x) =>
            x.id === s.activeBriefId
              ? { ...x, value: { ...x.value, PromptForImageGeneration: prompt } }
              : x,
          ),
        })),
      setActiveBrief: (id) => set({ activeBriefId: id }),
      userWishes: "",
      setUserWishes: (s) => set({ userWishes: s }),

      briefMode: "design",
      setBriefMode: (m) => set({ briefMode: m }),

      specVersions: [],
      activeSpecId: null,
      pushSpec: (spec) => {
        const ver = v(spec);
        set((s) => ({ specVersions: [...s.specVersions, ver], activeSpecId: ver.id }));
      },
      setActiveSpec: (id) => set({ activeSpecId: id }),

      imageVersions: [],
      activeImageId: null,
      pushImage: (dataUrl) => {
        const ver = v(dataUrl);
        set((s) => ({ imageVersions: [...s.imageVersions, ver], activeImageId: ver.id }));
      },
      setActiveImage: (id) => set({ activeImageId: id }),

      models: {
        analysis: DEFAULT_TEXT_MODEL,
        brief: DEFAULT_TEXT_MODEL,
        image: DEFAULT_IMAGE_MODEL,
      },
      setModel: (k, id) => set((s) => ({ models: { ...s.models, [k]: id } })),
    }),
    {
      name: "infographic-project",
      version: 3,
      migrate: () => undefined as unknown as ProjectState,
      storage: createJSONStorage(() => (typeof window !== "undefined" ? sessionStorage : (undefined as unknown as Storage))),
    },
  ),
);

export function useActiveContent() {
  return useProjectStore((s) => s.contentVersions.find((v) => v.id === s.activeContentId) ?? null);
}
export function useActiveBrief() {
  return useProjectStore((s) => s.briefVersions.find((v) => v.id === s.activeBriefId) ?? null);
}
export function useActiveImage() {
  return useProjectStore((s) => s.imageVersions.find((v) => v.id === s.activeImageId) ?? null);
}
export function useActiveSpec() {
  return useProjectStore((s) => s.specVersions.find((v) => v.id === s.activeSpecId) ?? null);
}
