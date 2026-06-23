import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AnalysisEntity,
  AnalysisJson,
  ContentSummary,
  DesignBriefResult,
  SourceText,
  Versioned,
} from "@/lib/types";
import type { ProgrammaticRenderSpec } from "@/lib/render-spec/types";
import { DEFAULT_IMAGE_MODEL, DEFAULT_TEXT_MODEL } from "@/lib/models";
import { renderAnalysisJson } from "@/lib/analysis-render";


export type BriefMode = "design" | "programmatic";

function v<T>(value: T): Versioned<T> {
  return { id: crypto.randomUUID(), createdAt: Date.now(), value };
}

interface ProjectState {
  source: SourceText;
  setSource: (patch: Partial<SourceText>) => void;
  resetProject: () => void;

  attachedImages: string[]; // data URLs passed to multimodal analysis
  addAttachedImages: (urls: string[]) => void;
  removeAttachedImage: (idx: number) => void;
  clearAttachedImages: () => void;



  contentVersions: Versioned<ContentSummary>[];
  activeContentId: string | null;
  pushContent: (c: ContentSummary) => void;
  updateActiveContent: (text: string) => void;
  updateActiveAnalysisEntity: (index: number, patch: Partial<AnalysisEntity>) => void;
  updateActiveAnalysisHeader: (patch: { topic?: string; subject?: string | null; grade?: string | null; summary?: string }) => void;
  replaceActiveAnalysis: (analysis: AnalysisJson) => void;
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

  // Simple-mode (home page) image versions: each carries its source prompt for traceability.
  simpleCurrentImage: { dataUrl: string; prompt: string } | null;
  simpleImageVersions: { id: string; dataUrl: string; prompt: string; createdAt: number }[];
  setSimpleCurrentImage: (img: { dataUrl: string; prompt: string } | null) => void;
  archiveSimpleCurrentImage: () => void;
  swapSimpleVersion: (id: string) => void;
  clearSimpleImages: () => void;

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
          attachedImages: [],
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
          simpleCurrentImage: null,
          simpleImageVersions: [],

        }),

      attachedImages: [],
      addAttachedImages: (urls) =>
        set((s) => ({ attachedImages: [...s.attachedImages, ...urls] })),
      removeAttachedImage: (idx) =>
        set((s) => ({ attachedImages: s.attachedImages.filter((_, i) => i !== idx) })),
      clearAttachedImages: () => set({ attachedImages: [] }),



      contentVersions: [],
      activeContentId: null,
      pushContent: (c) => {
        const ver = v(c);
        set((s) => ({
          contentVersions: [...s.contentVersions, ver],
          activeContentId: ver.id,
          selectedStyleId: s.selectedStyleId ?? c.recommendedStyle,
          selectedProfileName: s.selectedProfileName ?? c.recommendedDesignProfile ?? null,
        }));
      },

      updateActiveContent: (text) =>
        set((s) => ({
          contentVersions: s.contentVersions.map((x) =>
            x.id === s.activeContentId ? { ...x, value: { ...x.value, content: text } } : x,
          ),
        })),
      updateActiveAnalysisEntity: (index, patch) =>
        set((s) => ({
          contentVersions: s.contentVersions.map((x) => {
            if (x.id !== s.activeContentId) return x;
            const analysis = x.value.analysis;
            if (!analysis) return x;
            const entities = analysis.entities.map((e, i) =>
              i === index ? { ...e, ...patch } : e,
            );
            const newAnalysis = { ...analysis, entities };
            return {
              ...x,
              value: {
                ...x.value,
                analysis: newAnalysis,
                content: renderAnalysisJson(newAnalysis),
              },
            };
          }),
        })),
      updateActiveAnalysisHeader: (patch) =>
        set((s) => ({
          contentVersions: s.contentVersions.map((x) => {
            if (x.id !== s.activeContentId) return x;
            const analysis = x.value.analysis;
            if (!analysis) return x;
            const newAnalysis = { ...analysis, ...patch };
            return {
              ...x,
              value: {
                ...x.value,
                analysis: newAnalysis,
                content: renderAnalysisJson(newAnalysis),
              },
            };
          }),
        })),
      replaceActiveAnalysis: (analysis) =>
        set((s) => ({
          contentVersions: s.contentVersions.map((x) =>
            x.id === s.activeContentId
              ? { ...x, value: { ...x.value, analysis, content: renderAnalysisJson(analysis) } }
              : x,
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

      simpleCurrentImage: null,
      simpleImageVersions: [],
      setSimpleCurrentImage: (img) => set({ simpleCurrentImage: img }),
      archiveSimpleCurrentImage: () =>
        set((s) => {
          if (!s.simpleCurrentImage) return {};
          return {
            simpleImageVersions: [
              ...s.simpleImageVersions,
              { id: crypto.randomUUID(), createdAt: Date.now(), ...s.simpleCurrentImage },
            ],
            simpleCurrentImage: null,
          };
        }),
      clearSimpleImages: () => set({ simpleCurrentImage: null, simpleImageVersions: [] }),
      swapSimpleVersion: (id) =>
        set((s) => {
          if (!s.simpleCurrentImage) return {};
          const idx = s.simpleImageVersions.findIndex((v) => v.id === id);
          if (idx < 0) return {};
          const chosen = s.simpleImageVersions[idx];
          const newVersions = s.simpleImageVersions.slice();
          newVersions.splice(idx, 1);
          newVersions.push({
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            dataUrl: s.simpleCurrentImage.dataUrl,
            prompt: s.simpleCurrentImage.prompt,
          });
          return {
            simpleImageVersions: newVersions,
            simpleCurrentImage: { dataUrl: chosen.dataUrl, prompt: chosen.prompt },
          };
        }),


      models: {
        analysis: DEFAULT_TEXT_MODEL,
        brief: DEFAULT_TEXT_MODEL,
        image: DEFAULT_IMAGE_MODEL,
      },
      setModel: (k, id) => set((s) => ({ models: { ...s.models, [k]: id } })),
    }),
    {
      name: "infographic-project",
      version: 5,
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
