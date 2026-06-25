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

export interface SimpleImageEntry {
  id: string;
  dataUrl: string;
  prompt: string;
  versionNumber: number;
  createdAt?: number;
}

function v<T>(value: T): Versioned<T> {
  return { id: crypto.randomUUID(), createdAt: Date.now(), value };
}

function nextSimpleVersionNumber(
  versions: { versionNumber?: number }[],
  current: { versionNumber?: number } | null,
): number {
  const nums = [
    ...versions.map((item) => item.versionNumber ?? 0),
    current?.versionNumber ?? 0,
  ].filter((n) => n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function resolveSimpleVersionNumber(
  entry: { versionNumber?: number; createdAt: number },
  pool: { versionNumber?: number; createdAt: number }[],
): number {
  if (entry.versionNumber != null) return entry.versionNumber;
  const sorted = [...pool].sort((a, b) => a.createdAt - b.createdAt);
  const idx = sorted.findIndex((x) => x.createdAt === entry.createdAt);
  return idx >= 0 ? idx + 1 : sorted.length + 1;
}

interface ProjectState {
  source: SourceText;
  setSource: (patch: Partial<SourceText>) => void;
  resetProject: () => void;

  attachedImages: string[]; // data URLs passed to multimodal analysis
  addAttachedImages: (urls: string[]) => void;
  removeAttachedImage: (idx: number) => void;
  clearAttachedImages: () => void;

  /** Text extracted from uploaded files — not shown in the textarea. */
  uploadedSourceText: string;
  setUploadedSourceText: (text: string) => void;
  appendUploadedSourceText: (chunk: string) => void;



  contentVersions: Versioned<ContentSummary>[];
  activeContentId: string | null;
  pushContent: (c: ContentSummary) => void;
  updateActiveContent: (text: string) => void;
  updateActiveAnalysisEntity: (index: number, patch: Partial<AnalysisEntity>) => void;
  deleteActiveAnalysisEntity: (index: number) => void;
  swapActiveAnalysisEntities: (i: number, j: number) => void;
  addActiveAnalysisEntity: (entity: AnalysisEntity) => void;
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
  simpleCurrentImage: SimpleImageEntry | null;
  simpleImageVersions: (SimpleImageEntry & { createdAt: number })[];
  simpleImageRatings: Record<string, "like" | "dislike">;
  setSimpleCurrentImage: (img: { id?: string; dataUrl: string; prompt: string; versionNumber?: number } | null) => void;
  setSimpleImageRating: (id: string, rating: "like" | "dislike") => void;
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
  educationalIllustrations: true,
  narrativeIllustrations: false,
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
          uploadedSourceText: "",
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
          simpleImageRatings: {},

        }),

      attachedImages: [],
      addAttachedImages: (urls) =>
        set((s) => ({ attachedImages: [...s.attachedImages, ...urls] })),
      removeAttachedImage: (idx) =>
        set((s) => ({ attachedImages: s.attachedImages.filter((_, i) => i !== idx) })),
      clearAttachedImages: () => set({ attachedImages: [] }),

      uploadedSourceText: "",
      setUploadedSourceText: (text) => set({ uploadedSourceText: text }),
      appendUploadedSourceText: (chunk) =>
        set((s) => {
          const next = chunk.trim();
          if (!next) return {};
          const cur = s.uploadedSourceText.trim();
          return { uploadedSourceText: cur ? `${cur}\n\n${next}` : next };
        }),



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
            const SECTION_ORDER: AnalysisEntity["sectionId"][] = ["prerequisites", "main", "additions"];
            const oldSec = analysis.entities[index]?.sectionId;
            const newSec = (patch.sectionId ?? oldSec) as AnalysisEntity["sectionId"];
            let entities = analysis.entities.map((e, i) =>
              i === index ? { ...e, ...patch } : e,
            );
            if (oldSec && newSec && newSec !== oldSec) {
              const oldIdx = SECTION_ORDER.indexOf(oldSec);
              const newIdx = SECTION_ORDER.indexOf(newSec);
              const moved = entities[index];
              entities = entities.filter((_, i) => i !== index);
              const hasAny = entities.some((e) => e.sectionId === newSec);
              let pos: number;
              if (hasAny) {
                if (newIdx > oldIdx) {
                  // moving to a later section: place ABOVE the topmost card of that section
                  pos = entities.findIndex((e) => e.sectionId === newSec);
                } else {
                  // moving to an earlier section: place BELOW the bottommost card of that section
                  let lastNew = -1;
                  entities.forEach((e, i) => { if (e.sectionId === newSec) lastNew = i; });
                  pos = lastNew + 1;
                }
              } else {
                // no cards in target section
                if (newSec === "prerequisites") pos = 0;
                else pos = entities.length; // "additions" → end; "main" is unreachable per spec
              }
              entities.splice(pos, 0, moved);
            }
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
      deleteActiveAnalysisEntity: (index) =>
        set((s) => ({
          contentVersions: s.contentVersions.map((x) => {
            if (x.id !== s.activeContentId) return x;
            const analysis = x.value.analysis;
            if (!analysis) return x;
            const entities = analysis.entities.filter((_, i) => i !== index);
            const newAnalysis = { ...analysis, entities };
            return {
              ...x,
              value: { ...x.value, analysis: newAnalysis, content: renderAnalysisJson(newAnalysis) },
            };
          }),
        })),
      swapActiveAnalysisEntities: (i, j) =>
        set((s) => ({
          contentVersions: s.contentVersions.map((x) => {
            if (x.id !== s.activeContentId) return x;
            const analysis = x.value.analysis;
            if (!analysis) return x;
            if (i < 0 || j < 0 || i >= analysis.entities.length || j >= analysis.entities.length) return x;
            const entities = analysis.entities.slice();
            [entities[i], entities[j]] = [entities[j], entities[i]];
            const newAnalysis = { ...analysis, entities };
            return {
              ...x,
              value: { ...x.value, analysis: newAnalysis, content: renderAnalysisJson(newAnalysis) },
            };
          }),
        })),
      addActiveAnalysisEntity: (entity) =>
        set((s) => ({
          contentVersions: s.contentVersions.map((x) => {
            if (x.id !== s.activeContentId) return x;
            const analysis = x.value.analysis;
            if (!analysis) return x;
            const entities = analysis.entities.slice();
            // place at the end of its section
            let lastSec = -1;
            entities.forEach((e, i) => { if (e.sectionId === entity.sectionId) lastSec = i; });
            const pos = lastSec === -1 ? entities.length : lastSec + 1;
            entities.splice(pos, 0, entity);
            const newAnalysis = { ...analysis, entities };
            return {
              ...x,
              value: { ...x.value, analysis: newAnalysis, content: renderAnalysisJson(newAnalysis) },
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
      simpleImageRatings: {},
      setSimpleCurrentImage: (img) =>
        set((s) => {
          if (!img) return { simpleCurrentImage: null };
          const versionNumber =
            img.versionNumber ?? nextSimpleVersionNumber(s.simpleImageVersions, s.simpleCurrentImage);
          return {
            simpleCurrentImage: {
              id: img.id ?? crypto.randomUUID(),
              dataUrl: img.dataUrl,
              prompt: img.prompt,
              versionNumber,
            },
          };
        }),
      setSimpleImageRating: (id, rating) =>
        set((s) => ({
          simpleImageRatings: { ...s.simpleImageRatings, [id]: rating },
        })),
      archiveSimpleCurrentImage: () =>
        set((s) => {
          if (!s.simpleCurrentImage) return {};
          const versionNumber =
            s.simpleCurrentImage.versionNumber ??
            nextSimpleVersionNumber(s.simpleImageVersions, s.simpleCurrentImage);
          const id = s.simpleCurrentImage.id ?? crypto.randomUUID();
          return {
            simpleImageVersions: [
              ...s.simpleImageVersions,
              {
                id,
                createdAt: Date.now(),
                dataUrl: s.simpleCurrentImage.dataUrl,
                prompt: s.simpleCurrentImage.prompt,
                versionNumber,
              },
            ],
            simpleCurrentImage: null,
          };
        }),
      clearSimpleImages: () =>
        set({ simpleCurrentImage: null, simpleImageVersions: [], simpleImageRatings: {} }),
      swapSimpleVersion: (id) =>
        set((s) => {
          if (!s.simpleCurrentImage) return {};
          const idx = s.simpleImageVersions.findIndex((v) => v.id === id);
          if (idx < 0) return {};
          const chosen = s.simpleImageVersions[idx];
          const currentVersionNumber =
            s.simpleCurrentImage.versionNumber ??
            nextSimpleVersionNumber(s.simpleImageVersions, s.simpleCurrentImage);
          const currentId = s.simpleCurrentImage.id ?? crypto.randomUUID();
          const newVersions = s.simpleImageVersions.slice();
          newVersions.splice(idx, 1);
          newVersions.push({
            id: currentId,
            createdAt: Date.now(),
            dataUrl: s.simpleCurrentImage.dataUrl,
            prompt: s.simpleCurrentImage.prompt,
            versionNumber: currentVersionNumber,
          });
          return {
            simpleImageVersions: newVersions,
            simpleCurrentImage: {
              id: chosen.id,
              dataUrl: chosen.dataUrl,
              prompt: chosen.prompt,
              versionNumber: resolveSimpleVersionNumber(chosen, s.simpleImageVersions),
            },
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
      version: 7,
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
