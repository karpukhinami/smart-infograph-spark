import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect, type RefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, RefreshCw, RotateCcw, Upload, Sparkles, Download, Wand2 } from "lucide-react";
import {
  useProjectStore,
  useActiveContent,
  useActiveBrief,
  useActiveImage,
  getActiveContentVersion,
} from "@/store/useProjectStore";
import { useSettingsStore, useCurrentPrompts, useCurrentStyles } from "@/store/useSettingsStore";
import { ModelPicker } from "@/components/workspace/ModelPicker";
import { PromptDisclosure } from "@/components/workspace/PromptDisclosure";
import { Markdown } from "@/components/workspace/Markdown";
import { WorkspaceContentPreview } from "@/components/workspace/WorkspaceContentPreview";
import { ConnectionSchemaPreview } from "@/components/workspace/ConnectionSchemaPreview";
import { A4AutoLayoutView, type ManualLayoutApply } from "@/components/workspace/A4AutoLayoutView";
import { A4LayoutCanvas, type A4LayoutCanvasHandle } from "@/components/workspace/A4LayoutCanvas";
import { WireframeView } from "@/components/workspace/WireframeView";
import { ProgrammaticRenderer } from "@/components/render-spec/ProgrammaticRenderer";
import { RefineDialog } from "@/components/workspace/RefineDialog";
import { callTextLLM, callImageLLM } from "@/lib/llm-client";
import { HelpFiles } from "@/components/workspace/HelpFiles";
import { callTextLLMForJson } from "@/lib/llm-json";
import { buildDesignBriefPrompt, designProfileColorsAndRules, resolveDesignProfile } from "@/lib/prompt-injection";
import { renderAnalysisJson, validateAnalysisJson } from "@/lib/analysis-render";
import { renderConnectionSchemaJson, validateConnectionSchemaJson } from "@/lib/connection-schema";
import {
  buildRefineContentPrompt,
  buildRefineBriefPrompt,
  buildRefineImageDecisionPrompt,
} from "@/lib/refine-prompts";
// recognize-image prompt no longer used: images are passed multimodally to the analysis model.
import executionRulesText from "@/data/prompts/execution-rules.txt?raw";
import type { ContentSummary, DesignBriefResult, InfographicStyle, PaneMode } from "@/lib/types";
import {
  buildA4AILayout,
  buildAIInputJSON,
  normalizeAIResponse,
  type AILayoutResult,
} from "@/lib/a4-layout";
import { toPng } from "html-to-image";
import { ProfileSelect } from "@/components/design-profile/ProfileSelect";
import { importSourceFiles, SOURCE_FILE_ACCEPT } from "@/lib/source-file-import";
import { buildSourceTextForPrompt, hasSourceMaterials } from "@/lib/source-material";


export const Route = createFileRoute("/workspace")({
  head: () => ({ meta: [{ title: "Рабочее место — AI Infographic Generator" }] }),
  component: Workspace,
});

const SUBJECTS = [
  "Математика", "Алгебра", "Геометрия", "Русский язык", "Литература",
  "Физика", "Химия", "Биология", "География", "История",
  "Обществознание", "Информатика", "Английский язык", "Окружающий мир",
  "Технология", "ИЗО", "Музыка", "Физкультура", "ОБЖ", "Астрономия",
  "Другое",
];
const GRADES = [...Array.from({ length: 11 }, (_, i) => String(i + 1)), "Другое"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function Workspace() {
  const source = useProjectStore((s) => s.source);
  const setSource = useProjectStore((s) => s.setSource);
  const resetProject = useProjectStore((s) => s.resetProject);
  const models = useProjectStore((s) => s.models);
  const setModel = useProjectStore((s) => s.setModel);
  const pushContent = useProjectStore((s) => s.pushContent);
  const updateActiveContent = useProjectStore((s) => s.updateActiveContent);
  const selectedStyleId = useProjectStore((s) => s.selectedStyleId);
  const setSelectedStyleId = useProjectStore((s) => s.setSelectedStyleId);
  const selectedProfileName = useProjectStore((s) => s.selectedProfileName);
  const setSelectedProfileName = useProjectStore((s) => s.setSelectedProfileName);
  const pushBrief = useProjectStore((s) => s.pushBrief);
  const updateActiveBriefPrompt = useProjectStore((s) => s.updateActiveBriefPrompt);
  const userWishes = useProjectStore((s) => s.userWishes);
  const setUserWishes = useProjectStore((s) => s.setUserWishes);
  const pushImage = useProjectStore((s) => s.pushImage);
  const briefMode = useProjectStore((s) => s.briefMode);
  const setBriefMode = useProjectStore((s) => s.setBriefMode);
  const attachedImages = useProjectStore((s) => s.attachedImages);
  const addAttachedImages = useProjectStore((s) => s.addAttachedImages);
  const uploadedSourceText = useProjectStore((s) => s.uploadedSourceText);
  const setUploadedSourceText = useProjectStore((s) => s.setUploadedSourceText);

  const activeContent = useActiveContent();
  const activeBrief = useActiveBrief();
  const activeImage = useActiveImage();

  const mode = useSettingsStore((s) => s.mode);
  const prompts = useCurrentPrompts();
  const setPrompt = useSettingsStore((s) => s.setPrompt);
  const styles = useCurrentStyles();
  const profiles = useSettingsStore((s) => s.profiles);

  const [paneMode, setPaneMode] = useState<PaneMode>("content");
  const [loading, setLoading] = useState<null | "analyze" | "brief" | "image" | "recognize" | "refine" | "ai-layout" | "detect-style">(null);
  const [detectResult, setDetectResult] = useState<{ explanation: string; styleName: string } | null>(null);
  const [refineStage, setRefineStage] = useState<null | "content" | "brief" | "image">(null);
  const [manualLayoutTemplate, setManualLayoutTemplate] = useState("");
  const [manualBalanceRowFonts, setManualBalanceRowFonts] = useState(true);
  const [manualAllowAddendumRight, setManualAllowAddendumRight] = useState(true);
  const [manualAccentHighlightText, setManualAccentHighlightText] = useState(true);
  const [appliedManualLayout, setAppliedManualLayout] = useState<ManualLayoutApply | null>(null);
  const [autoLayoutEpoch, setAutoLayoutEpoch] = useState(0);
  const [aiLayoutResult, setAiLayoutResult] = useState<AILayoutResult | null>(null);
  const autoLayoutCanvasRef = useRef<A4LayoutCanvasHandle>(null);
  const aiLayoutCanvasRef = useRef<A4LayoutCanvasHandle>(null);
  const [layoutExporting, setLayoutExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const enabledStyles = useMemo<InfographicStyle[]>(() => styles.filter((s) => s.enabled), [styles]);
  const activeStyle = useMemo(
    () => styles.find((s) => s.id === (selectedStyleId ?? activeContent?.value.recommendedStyle)),
    [styles, selectedStyleId, activeContent],
  );
  const effectiveProfileName = useMemo(
    () =>
      selectedProfileName ??
      activeContent?.value.recommendedDesignProfile ??
      activeContent?.value.analysis?.recommendedDesignProfile ??
      null,
    [
      selectedProfileName,
      activeContent?.value.recommendedDesignProfile,
      activeContent?.value.analysis?.recommendedDesignProfile,
    ],
  );
  const activeProfile = useMemo(
    () => resolveDesignProfile(profiles, effectiveProfileName),
    [profiles, effectiveProfileName],
  );

  const hasSource = hasSourceMaterials(source.text, uploadedSourceText, attachedImages);
  const useTopicOnlyPrompt = !hasSource;

  useEffect(() => {
    setAppliedManualLayout(null);
    setAiLayoutResult(null);
  }, [activeContent?.id]);

  const aiLayoutCanvas = useMemo(() => {
    if (!activeContent?.value.analysis || !aiLayoutResult) return null;
    return buildA4AILayout(activeContent.value.analysis, aiLayoutResult, {
      balanceRowFonts: manualBalanceRowFonts,
      allowAddendumRight: manualAllowAddendumRight,
    });
  }, [
    activeContent?.value.analysis,
    aiLayoutResult,
    manualBalanceRowFonts,
    manualAllowAddendumRight,
  ]);

  const layoutDomFitOptions = useMemo(
    () => ({
      balanceRowFonts: manualBalanceRowFonts,
      allowAddendumRight: manualAllowAddendumRight,
    }),
    [manualBalanceRowFonts, manualAllowAddendumRight],
  );

  function onRecalculateManualLayout() {
    const contentVer = getActiveContentVersion();
    if (!contentVer?.value.analysis) {
      toast.error("Сначала выполните анализ контента");
      return;
    }
    setAppliedManualLayout({
      template: manualLayoutTemplate.trim(),
    });
    setPaneMode("auto-layout");
    toast.success(
      manualLayoutTemplate.trim()
        ? "Макет пересчитан по шаблону"
        : "Макет пересчитан (ряды как в авто)",
    );
  }

  function onRedrawAutoLayout() {
    const contentVer = getActiveContentVersion();
    if (!contentVer?.value.analysis) {
      toast.error("Сначала выполните анализ контента");
      return;
    }
    setAppliedManualLayout(null);
    setAutoLayoutEpoch((n) => n + 1);
    setPaneMode("auto-layout");
    toast.success("Авто-макет пересчитан по текущему контенту");
  }

  async function onExportLayout(ref: RefObject<A4LayoutCanvasHandle | null>) {
    if (!ref.current) return;
    try {
      setLayoutExporting(true);
      await ref.current.exportPng();
    } finally {
      setLayoutExporting(false);
    }
  }

  // Legacy OCR-as-text fallback removed: images are now passed multimodally to the analysis model.


  async function attachImageFiles(files: File[]) {
    if (!files.length) return;
    try {
      const dataUrls = await Promise.all(files.map(fileToDataUrl));
      addAttachedImages(dataUrls);
      toast.success(`Прикреплено картинок: ${files.length}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось прикрепить картинку");
    }
  }

  async function onPasteCapture(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageFiles = items
      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (imageFiles.length) {
      e.preventDefault();
      await attachImageFiles(imageFiles);
    }
  }

  async function onFileChosen(files: FileList | null) {
    if (!files?.length) return;
    await importSourceFiles(Array.from(files), {
      getUploadedText: () => uploadedSourceText,
      setUploadedText: setUploadedSourceText,
      addImages: addAttachedImages,
      onSuccess: (message) => toast.success(message),
      onError: (message) => toast.error(message),
    });
  }


  // Default the workspace style selector to bento (or first enabled) once styles are known.
  useEffect(() => {
    if (selectedStyleId) return;
    const bento = enabledStyles.find((s) => s.id === "modern-bento");
    const fallback = bento?.id ?? enabledStyles[0]?.id;
    if (fallback) setSelectedStyleId(fallback);
  }, [selectedStyleId, enabledStyles, setSelectedStyleId]);

  async function onDetectStyle() {
    if (!prompts.detectStyle?.trim()) {
      toast.error("Промпт подбора стиля пуст");
      return;
    }
    if (enabledStyles.length === 0) {
      toast.error("Нет активных стилей — включите хотя бы один на странице «Стили»");
      return;
    }
    try {
      setLoading("detect-style");
      const stylesJson = JSON.stringify(
        enabledStyles.map((s) => ({
          id: s.id,
          name: s.name,
          detectionFeatures: s.detectionFeatures ?? "",
        })),
        null,
        2,
      );
      const filled = prompts.detectStyle
        .replaceAll("{{USER_INSTRUCTIONS}}", source.userInstructions || "(нет)")
        .replaceAll("{{SOURCE_TEXT}}", buildSourceTextForPrompt(source.text, uploadedSourceText) || "(нет)")
        .replaceAll("{{TOPIC}}", source.topic || "(не задана)")
        .replaceAll("{{SUBJECT}}", source.subject || "(не задан)")
        .replaceAll("{{GRADE}}", source.grade || "(не задан)")
        .replaceAll("{{STYLES_JSON}}", stylesJson);
      const imgs = attachedImages.length ? attachedImages : undefined;
      const parsed = await callTextLLMForJson({
        model: models.analysis,
        prompt: filled,
        label: "detect style",
        schemaHint: 'Верни JSON-объект вида { "styleId": string, "explanation": string }.',
        parse: (v) => v as { styleId: string; explanation: string },
        images: imgs,
      });
      const match = enabledStyles.find((s) => s.id === parsed.styleId);
      const fallback = enabledStyles.find((s) => s.id === "modern-bento") ?? enabledStyles[0];
      const chosen = match ?? fallback;
      if (chosen) setSelectedStyleId(chosen.id);
      setDetectResult({
        explanation: parsed.explanation || "(модель не вернула пояснение)",
        styleName: chosen?.name ?? parsed.styleId,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось определить стиль");
    } finally {
      setLoading(null);
    }
  }

  async function onAnalyze() {
    try {
      setLoading("analyze");
      const stylesList = enabledStyles.map((s) => `- ${s.id}: ${s.name} — ${s.shortDescription}`).join("\n");
      const isConnectionStyle = selectedStyleId === "connection-schema";
      const template = isConnectionStyle
        ? useTopicOnlyPrompt
          ? prompts.connectionSchemaTopicOnly
          : prompts.connectionSchemaWithContent
        : useTopicOnlyPrompt
          ? prompts.analysisTopicOnly
          : prompts.analysisWithContent;
      const filled = template
        .replaceAll("{{USER_INSTRUCTIONS}}", source.userInstructions || "(нет)")
        .replaceAll("{{STYLES_LIST}}", stylesList || "(стилей не задано)")
        .replaceAll("{{SOURCE_TEXT}}", buildSourceTextForPrompt(source.text, uploadedSourceText) || "")
        .replaceAll("{{TOPIC}}", source.topic || "")
        .replaceAll("{{SUBJECT}}", source.subject || "")
        .replaceAll("{{GRADE}}", source.grade || "");

      let summary: ContentSummary;
      const imgs = attachedImages.length ? attachedImages : undefined;
      if (mode === "strict" && isConnectionStyle) {
        const connection = await callTextLLMForJson({
          model: models.analysis,
          prompt: filled,
          label: "connection-schema",
          schemaHint:
            'Верни JSON-объект схемы связей со структурой { topic, subject, grade, focusQuestion, displaySubtitle, regions: [{ id, number, title, organizationType, anchorEntityId, entities: [{ id, title, text, addendum, depiction }], relations: [{ from, to, direction, label }] }], regionRelations: [{ fromRegion, toRegion, direction, label }] }. Все обратные слеши внутри строк должны быть удвоены.',
          parse: validateConnectionSchemaJson,
          images: imgs,
        });
        summary = {
          content: renderConnectionSchemaJson(connection),
          recommendedStyle: "connection-schema",
          recommendedDesignProfile: null,
          connection,
        };
      } else if (mode === "strict") {
        const analysis = await callTextLLMForJson({
          model: models.analysis,
          prompt: filled,
          label: "analysis",
          schemaHint:
            'Верни JSON-объект анализа со структурой { sourceMode, topic, subject, grade, recommendedDesignProfile, summary, entities: [{ sectionId: "prerequisites"|"main"|"additions", entityType, attention: "main"|"normal"|"accent", title, content, formula, cardAddendum, items, icon, visual }], warnings }. Все обратные слеши внутри строк должны быть удвоены (\\\\frac, \\\\sqrt и т.п.).',
          parse: validateAnalysisJson,
          images: imgs,
        });
        const fallbackStyle = enabledStyles[0]?.id ?? "";
        summary = {
          content: renderAnalysisJson(analysis),
          recommendedStyle: selectedStyleId ?? fallbackStyle,
          recommendedDesignProfile: analysis.recommendedDesignProfile ?? null,
          analysis,
        };
      } else {
        // Free mode: model returns plain Markdown, not JSON.
        const raw = await callTextLLM({ model: models.analysis, prompt: filled, images: imgs });
        const content = (raw ?? "").trim();
        if (!content) throw new Error("Модель вернула пустой ответ");
        const fallbackStyle = enabledStyles[0]?.id ?? "";
        const rdpMatch = content.match(/\[recommendedDesignProfile:\s*(Оранжевый|Индиго)\s*\]/i);
        const cleaned = rdpMatch ? content.replace(rdpMatch[0], "").trim() : content;
        summary = {
          content: cleaned,
          recommendedStyle: selectedStyleId ?? fallbackStyle,
          recommendedDesignProfile: rdpMatch?.[1] ?? null,
        };
      }

      pushContent(summary);
      setPaneMode("content");
      toast.success("Контент проанализирован");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось выполнить анализ");
    } finally {
      setLoading(null);
    }
  }

  async function onCreateBrief() {
    if (!activeContent) return;
    if (!activeStyle) { toast.error("Сначала выберите стиль"); return; }
    try {
      setLoading("brief");
      const filled = buildDesignBriefPrompt({
        template: prompts.designBrief,
        contentSummary: activeContent.value.content,
        style: activeStyle,
        profile: activeProfile,
        userWishes,
        generalRules: prompts.generalRules,
      });
      const parsed = await callTextLLMForJson({
        model: models.brief,
        prompt: filled,
        label: "design brief",
        schemaHint: 'Верни JSON-объект формы { "PromptForImageGeneration": string, "WireframeSketch": string } или { "PromptForImageGeneration": string, "WireframeDescription": object }.',
        parse: (value) => value as DesignBriefResult,
      });
      if (!parsed.PromptForImageGeneration || (!parsed.WireframeDescription && !parsed.WireframeSketch)) {
        throw new Error("В ответе модели не хватает полей");
      }
      if (mode === "strict") {
        const layer1 = designProfileColorsAndRules(activeProfile);
        parsed.PromptForImageGeneration = `${layer1}\n\n${parsed.PromptForImageGeneration}`;
      }
      pushBrief(parsed);
      setPaneMode("wireframe");
      toast.success("Дизайн-бриф создан");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать бриф");
    } finally {
      setLoading(null);
    }
  }

  async function onCreateAILayout() {
    const contentVer = getActiveContentVersion();
    const analysis = contentVer?.value.analysis;
    if (!analysis) {
      toast.error("Сначала выполните анализ контента");
      return;
    }
    try {
      setLoading("ai-layout");
      const input = buildAIInputJSON(analysis);
      const prompt = `${prompts.codeBasedProduct.trim()}\n\nINPUT JSON:\n${JSON.stringify(input, null, 2)}`;
      const raw = await callTextLLM({ model: models.brief, prompt });
      const parsed = normalizeAIResponse(raw);
      setAiLayoutResult(parsed);
      setPaneMode("ai-layout");
      toast.success("Технический макет от AI создан");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать технический макет");
    } finally {
      setLoading(null);
    }
  }

  function buildFinalImagePrompt(basePrompt: string): string {
    const wishes = userWishes.trim();
    const head = wishes ? `${wishes}\n\n${basePrompt}` : basePrompt;
    return `${head}\n\n${executionRulesText.trim()}`;
  }

  async function onGenerateImage() {
    if (!activeBrief) return;
    try {
      setLoading("image");
      const prompt = buildFinalImagePrompt(activeBrief.value.PromptForImageGeneration);
      const dataUrl = await callImageLLM({ model: models.image, prompt });
      pushImage(dataUrl);
      setPaneMode("image");
      toast.success("Изображение сгенерировано");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось сгенерировать изображение");
    } finally {
      setLoading(null);
    }
  }

  async function onRefineContent(userText: string) {
    if (!activeContent) return;
    try {
      setLoading("refine");
      let summary: ContentSummary;
      if (mode === "strict") {
        const analysis = activeContent.value.analysis ?? null;
        const prompt = buildRefineContentPrompt({
          userInstructions: userText,
          currentAnalysisJson: analysis ? JSON.stringify(analysis, null, 2) : "",
          currentContentText: activeContent.value.content,
          strict: true,
        });
        const a = await callTextLLMForJson({
          model: models.analysis,
          prompt,
          label: "refine analysis",
          schemaHint: 'Верни JSON-объект анализа со структурой { sourceMode, topic, subject, grade, summary, entities, warnings }.',
          parse: validateAnalysisJson,
        });
        summary = {
          content: renderAnalysisJson(a),
          recommendedStyle: activeContent.value.recommendedStyle,
          analysis: a,
        };
      } else {
        // Free mode: refine plain Markdown content.
        const refinePrompt = `Ты — методист-редактор учебных инфографик. Внеси точечные изменения в существующий markdown-конспект по пожеланиям пользователя. Сохрани формат, структуру, заголовки и формулы в LaTeX ($...$ или $$...$$). Не возвращай JSON, не добавляй комментариев, верни только обновлённый markdown.

ПОЖЕЛАНИЯ ПОЛЬЗОВАТЕЛЯ:
${userText || "(не указано)"}

ТЕКУЩИЙ MARKDOWN-КОНСПЕКТ:
${activeContent.value.content}`;
        const raw = await callTextLLM({ model: models.analysis, prompt: refinePrompt });
        const content = (raw ?? "").trim();
        if (!content) throw new Error("Модель вернула пустой ответ");
        summary = { content, recommendedStyle: activeContent.value.recommendedStyle };
      }
      pushContent(summary);
      setPaneMode("content");
      setRefineStage(null);
      toast.success("Контент обновлён");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось перегенерировать контент");
    } finally {
      setLoading(null);
    }
  }

  async function onRefineBrief(userText: string) {
    if (!activeBrief) return;
    try {
      setLoading("refine");
      const prompt = buildRefineBriefPrompt({
        userInstructions: userText,
        currentBriefJson: JSON.stringify(activeBrief.value, null, 2),
      });
      const parsed = await callTextLLMForJson({
        model: models.brief,
        prompt,
        label: "refine brief",
        schemaHint: 'Верни JSON-объект формы { "PromptForImageGeneration": string, "WireframeSketch": string } или { "PromptForImageGeneration": string, "WireframeDescription": object }.',
        parse: (value) => value as DesignBriefResult,
      });
      if (!parsed.PromptForImageGeneration || (!parsed.WireframeDescription && !parsed.WireframeSketch)) {
        throw new Error("В ответе модели не хватает полей");
      }
      pushBrief(parsed);
      setPaneMode("wireframe");
      setRefineStage(null);
      toast.success("Расположение блоков обновлено");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось перегенерировать лэйаут");
    } finally {
      setLoading(null);
    }
  }

  async function onRefineImage(userText: string) {
    if (!activeBrief) return;
    try {
      setLoading("refine");
      const decisionPrompt = buildRefineImageDecisionPrompt({
        userInstructions: userText,
        currentImagePrompt: activeBrief.value.PromptForImageGeneration,
      });
      const decision = await callTextLLMForJson({
        model: models.brief,
        prompt: decisionPrompt,
        label: "refine image decision",
        schemaHint: 'Верни JSON-объект формы { "action": "patch" | "rebuild", "newPrompt"?: string, "reason"?: string }.',
        parse: (value) => value as { action: "patch" | "rebuild"; newPrompt?: string; reason?: string },
      });

      if (decision.action === "patch" && decision.newPrompt) {
        // Save patched prompt as a new brief version with the same wireframe.
        const next: DesignBriefResult = {
          PromptForImageGeneration: decision.newPrompt,
          WireframeDescription: activeBrief.value.WireframeDescription,
          WireframeSketch: activeBrief.value.WireframeSketch,
        };
        pushBrief(next);
        // Now generate the image with the patched prompt.
        const dataUrl = await callImageLLM({ model: models.image, prompt: buildFinalImagePrompt(decision.newPrompt) });
        pushImage(dataUrl);
        setPaneMode("image");
        setRefineStage(null);
        toast.success("Изображение перегенерировано по вашему описанию");
        return;
      }

      // Need to rebuild the brief — re-run design brief generation with user wishes prioritised.
      if (!activeContent || !activeStyle) {
        toast.error(decision.reason || "Нужно вернуться к шагу 2, но не хватает контента/стиля");
        return;
      }
      toast.message("Изменение требует перестройки брифа", { description: decision.reason ?? "" });
      const combinedWishes = userWishes.trim()
        ? `${userText}\n\n(предыдущие пожелания: ${userWishes.trim()})`
        : userText;
      const filled = buildDesignBriefPrompt({
        template: prompts.designBrief,
        contentSummary: activeContent.value.content,
        style: activeStyle,
        profile: activeProfile,
        userWishes: combinedWishes,
        generalRules: prompts.generalRules,
      });
      const parsed = await callTextLLMForJson({
        model: models.brief,
        prompt: filled,
        label: "design brief rebuild",
        schemaHint: 'Верни JSON-объект формы { "PromptForImageGeneration": string, "WireframeSketch": string } или { "PromptForImageGeneration": string, "WireframeDescription": object }.',
        parse: (value) => value as DesignBriefResult,
      });
      if (!parsed.PromptForImageGeneration || (!parsed.WireframeDescription && !parsed.WireframeSketch)) {
        throw new Error("В ответе модели не хватает полей");
      }
      if (mode === "strict") {
        const layer1 = designProfileColorsAndRules(activeProfile);
        parsed.PromptForImageGeneration = `${layer1}\n\n${parsed.PromptForImageGeneration}`;
      }
      pushBrief(parsed);
      const dataUrl = await callImageLLM({ model: models.image, prompt: buildFinalImagePrompt(parsed.PromptForImageGeneration) });
      pushImage(dataUrl);
      setPaneMode("image");
      setRefineStage(null);
      toast.success("Бриф и изображение перегенерированы");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось перегенерировать изображение");
    } finally {
      setLoading(null);
    }
  }



  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1600px] p-4 space-y-3">
      <div className="flex justify-end">
        <HelpFiles />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* LEFT */}
      <section className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">1 · Исходные данные</h2>
            <Button size="sm" variant="ghost" onClick={resetProject}>
              <RotateCcw className="size-3.5 mr-1" /> Начать заново
            </Button>
          </div>

          {/* Тема + предмет + класс */}
          <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
            <div>
              <Label className="text-xs">Тема инфографики</Label>
              <Input
                placeholder="например, Перенос запятой в десятичных дробях"
                value={source.topic ?? ""}
                onChange={(e) => setSource({ topic: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Предмет</Label>
                <Select value={source.subject || ""} onValueChange={(v) => setSource({ subject: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите предмет" /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Класс</Label>
                <Select value={source.grade || ""} onValueChange={(v) => setSource({ grade: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите класс" /></SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Дополнительные инструкции</Label>
            <Textarea
              rows={3}
              value={source.userInstructions}
              onChange={(e) => setSource({ userInstructions: e.target.value })}
              placeholder="На что сделать акцент, что пропустить, особенности аудитории…"
            />
          </div>

          {/* Источник: текст + файл + картинки */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Исходный материал (необязательно — без него работа пойдёт только по теме)
              </Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading !== null}
                >
                  <Upload className="size-3.5 mr-1" /> Файл
                </Button>
              </div>
            </div>
            <Textarea
              rows={8}
              placeholder="Введите или вставьте текст вручную. Файлы (.txt, .md, .docx, .pdf, изображения) — кнопкой «Файл»."
              value={source.text}
              onChange={(e) => setSource({ text: e.target.value })}
              onPaste={onPasteCapture}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={SOURCE_FILE_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => { void onFileChosen(e.target.files); e.target.value = ""; }}
            />
          </div>

          {/* Style detection panel */}
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <div className="text-xs font-semibold">Стиль инфографики</div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedStyleId ?? ""}
                onValueChange={setSelectedStyleId}
              >
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue placeholder="Выберите стиль" />
                </SelectTrigger>
                <SelectContent>
                  {enabledStyles.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={onDetectStyle}
                disabled={loading !== null || !(source.topic?.trim() || hasSource)}
              >
                {loading === "detect-style" ? <Loader2 className="size-4 animate-spin mr-2" /> : <Wand2 className="size-4 mr-2" />}
                Определить стиль
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              По кнопке модель анализирует исходные данные и признаки включённых стилей и предлагает подходящий.
            </p>
          </div>




          <PromptDisclosure
            label={`Показать промпт анализа (${useTopicOnlyPrompt ? "только по теме" : "с источником"})`}
            value={useTopicOnlyPrompt ? prompts.analysisTopicOnly : prompts.analysisWithContent}
            onChange={(v) =>
              setPrompt(useTopicOnlyPrompt ? "analysisTopicOnly" : "analysisWithContent", v)
            }
            rightSlot={<ModelPicker kind="text" value={models.analysis} onChange={(v) => setModel("analysis", v)} />}
          />

          <div className="flex justify-start">
            <Button onClick={onAnalyze} disabled={loading !== null || !(source.topic?.trim() || hasSource)}>
              {loading === "analyze" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Анализировать
            </Button>
          </div>
        </div>

        {/* STAGE 2 */}
        {activeContent && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">2 · Стиль и дизайн</h2>
              {mode === "strict" && (
                <Tabs value={briefMode} onValueChange={(v) => setBriefMode(v as "design" | "programmatic")}>
                  <TabsList className="h-8">
                    <TabsTrigger value="design" className="text-xs">Дизайн-бриф</TabsTrigger>
                    <TabsTrigger value="programmatic" className="text-xs">Технический макет</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Стиль инфографики</Label>
                <Select
                  value={selectedStyleId ?? activeContent.value.recommendedStyle}
                  onValueChange={setSelectedStyleId}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {enabledStyles.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Профиль дизайна (цвета и шрифты)</Label>
                <ProfileSelect
                  value={effectiveProfileName ?? activeProfile?.profileName ?? ""}
                  onChange={setSelectedProfileName}
                />
              </div>
            </div>
            {mode === "strict" && briefMode === "programmatic" && activeContent.value.connection ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Для стиля «схема связей» техническая визуализация строится программно из JSON (Mermaid).
                </p>
                <Button onClick={() => setPaneMode("mermaid")}>Построить схему связей</Button>
              </div>
            ) : mode === "strict" && briefMode === "programmatic" ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="manual-layout-template">
                    Ручной ввод шаблона
                  </Label>
                  <Textarea
                    id="manual-layout-template"
                    rows={5}
                    spellCheck={false}
                    placeholder={"1\n1:1\n1:2:1"}
                    value={manualLayoutTemplate}
                    onChange={(e) => setManualLayoutTemplate(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Одна строка — один ряд. Карточки берутся из JSON в исходном порядке:{" "}
                    <code>1</code> — одна на всю ширину, <code>1:1</code> — две поровну, <code>1:2:1</code> — три в заданной пропорции.
                    Пустое поле при пересчёте — те же ряды, что в авто-макете.
                  </p>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="manual-balance-fonts"
                        checked={manualBalanceRowFonts}
                        onCheckedChange={setManualBalanceRowFonts}
                      />
                      <Label htmlFor="manual-balance-fonts" className="text-xs font-normal cursor-pointer">
                        Подгонять размер шрифтов в ряду
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="manual-addendum-right"
                        checked={manualAllowAddendumRight}
                        onCheckedChange={setManualAllowAddendumRight}
                      />
                      <Label htmlFor="manual-addendum-right" className="text-xs font-normal cursor-pointer">
                        Переносить аддендумы
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="manual-accent-highlight"
                        checked={manualAccentHighlightText}
                        onCheckedChange={setManualAccentHighlightText}
                      />
                      <Label htmlFor="manual-accent-highlight" className="text-xs font-normal cursor-pointer">
                        Выделенный текст
                      </Label>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onRecalculateManualLayout}
                    disabled={loading !== null || !activeContent?.value.analysis}
                  >
                    Пересчитать
                  </Button>
                </div>
                <PromptDisclosure
                  label="Показать промпт технического макета"
                  value={prompts.codeBasedProduct}
                  onChange={(v) => setPrompt("codeBasedProduct", v)}
                  rightSlot={<ModelPicker kind="text" value={models.brief} onChange={(v) => setModel("brief", v)} />}
                />
                <div>
                  <Button onClick={onCreateAILayout} disabled={loading !== null || !activeContent?.value.analysis}>
                    {loading === "ai-layout" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    Создать технический макет
                  </Button>
                </div>
              </>
            ) : (
              <>
                <PromptDisclosure
                  label="Показать промпт дизайн-брифа"
                  value={prompts.designBrief}
                  onChange={(v) => setPrompt("designBrief", v)}
                  rightSlot={<ModelPicker kind="text" value={models.brief} onChange={(v) => setModel("brief", v)} />}
                />
                <div>
                  <Button onClick={onCreateBrief} disabled={loading !== null}>
                    {loading === "brief" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    Создать дизайн-бриф
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STAGE 3 — only in design-brief mode */}
        {activeBrief && !(mode === "strict" && briefMode === "programmatic") && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">3 · Генерация изображения</h2>
            <div>
              <Label className="text-xs">Дополнительные пожелания (приоритет при регенерации)</Label>
              <Textarea
                rows={3}
                value={userWishes}
                onChange={(e) => setUserWishes(e.target.value)}
                placeholder="Чем подкорректировать следующую генерацию…"
              />
            </div>
            <PromptDisclosure
              label="Показать промпт изображения"
              value={activeBrief.value.PromptForImageGeneration}
              onChange={(v) => updateActiveBriefPrompt(v)}
              rightSlot={<ModelPicker kind="image" value={models.image} onChange={(v) => setModel("image", v)} />}
            />
            <div>
              <Button onClick={onGenerateImage} disabled={loading !== null}>
                {loading === "image" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Сгенерировать изображение
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* RIGHT */}
      <section className="space-y-3">
        <div className="rounded-lg border border-border bg-card p-2">
          <Tabs value={paneMode} onValueChange={(v) => setPaneMode(v as PaneMode)}>
            <TabsList>
              <TabsTrigger value="content" disabled={!activeContent}>Контент</TabsTrigger>
              <TabsTrigger value="auto-layout" disabled={!activeContent?.value.analysis}>авто-макет</TabsTrigger>
              <TabsTrigger value="wireframe" disabled={!activeBrief}>Каркас</TabsTrigger>
              <TabsTrigger value="ai-layout" disabled={!aiLayoutCanvas}>ИИ-макет</TabsTrigger>
              <TabsTrigger value="mermaid" disabled={!activeContent?.value.connection}>Схема связей</TabsTrigger>
              <TabsTrigger value="image" disabled={!activeImage}>Итоговое изображение</TabsTrigger>
            </TabsList>

            <TabsContent value="mermaid" className="p-2 space-y-2">
              {activeContent?.value.connection ? (
                <ConnectionMermaidPreview connection={activeContent.value.connection} />
              ) : (
                <EmptyState text="Схема доступна для стиля «схема связей» после анализа." />
              )}
            </TabsContent>


            <TabsContent value="content" className="p-2 space-y-2">
              {activeContent ? (
                <>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRefineStage("content")} disabled={loading !== null}>
                      <Sparkles className="size-3.5 mr-1" /> Изменить с ИИ
                    </Button>
                    <Button size="sm" variant="outline" onClick={onAnalyze} disabled={loading !== null}>
                      <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
                    </Button>
                  </div>
                  <div className="rounded-md border border-border p-3 bg-background">
                    {activeContent.value.connection ? (
                      <ConnectionSchemaPreview
                        connection={activeContent.value.connection}
                        profile={activeProfile ?? null}
                      />
                    ) : activeContent.value.analysis ? (
                      <WorkspaceContentPreview
                        analysis={activeContent.value.analysis}
                        profile={activeProfile ?? null}
                        imageModel={models.image}
                      />
                    ) : (
                      <Markdown>{activeContent.value.content}</Markdown>
                    )}
                  </div>
                  {activeContent.value.analysis && (
                    <details className="rounded-md border border-border bg-background/60 p-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Показать структурированный JSON анализа
                      </summary>
                      <pre className="mt-2 overflow-auto text-xs">
                        {JSON.stringify(activeContent.value.analysis, null, 2)}
                      </pre>
                    </details>
                  )}
                  <Textarea
                    rows={8}
                    value={activeContent.value.content}
                    onChange={(e) => updateActiveContent(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Рекомендуемый стиль: <code>{activeContent.value.recommendedStyle || "—"}</code>
                  </p>
                </>
              ) : (
                <EmptyState text="Запустите анализ, чтобы увидеть здесь сводку по контенту." />
              )}
            </TabsContent>

            <TabsContent value="auto-layout" className="p-2 space-y-2">
              {activeContent?.value.analysis ? (
                <>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onRedrawAutoLayout}
                      disabled={loading !== null || layoutExporting}
                    >
                      <RefreshCw className="size-3.5 mr-1" />
                      Перерисовать авто-макет
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onExportLayout(autoLayoutCanvasRef)}
                      disabled={loading !== null || layoutExporting || paneMode !== "auto-layout"}
                    >
                      {layoutExporting ? (
                        <Loader2 className="size-3.5 mr-1 animate-spin" />
                      ) : (
                        <Download className="size-3.5 mr-1" />
                      )}
                      Экспорт PNG
                    </Button>
                  </div>
                  <A4AutoLayoutView
                    ref={autoLayoutCanvasRef}
                    key={autoLayoutEpoch}
                    analysis={activeContent.value.analysis}
                    active={paneMode === "auto-layout"}
                    profile={activeProfile}
                    manualApply={appliedManualLayout}
                    domFitOptions={layoutDomFitOptions}
                    accentHighlightText={manualAccentHighlightText}
                  />
                </>
              ) : (
                <EmptyState text="Авто-макет доступен после анализа в strict-режиме (структурированный JSON)." />
              )}
            </TabsContent>

            <TabsContent value="wireframe" className="p-2 space-y-2">
              {activeBrief ? (
                <>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRefineStage("brief")} disabled={loading !== null}>
                      <Sparkles className="size-3.5 mr-1" /> Изменить с ИИ
                    </Button>
                    <Button size="sm" variant="outline" onClick={onCreateBrief} disabled={loading !== null}>
                      <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
                    </Button>
                  </div>
                  {activeBrief.value.WireframeSketch ? (
                    <pre className="rounded-md border border-border bg-card p-3 text-xs leading-snug whitespace-pre overflow-auto font-mono">
                      {activeBrief.value.WireframeSketch}
                    </pre>
                  ) : activeBrief.value.WireframeDescription ? (
                    <WireframeView wf={activeBrief.value.WireframeDescription} />
                  ) : (
                    <EmptyState text="Каркас отсутствует в ответе модели." />
                  )}
                </>
              ) : (
                <EmptyState text="Создайте дизайн-бриф, чтобы увидеть каркас." />
              )}
            </TabsContent>

            <TabsContent value="ai-layout" className="p-2 space-y-2">
              {mode === "strict" && briefMode === "programmatic" && aiLayoutCanvas ? (
                <>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={onCreateAILayout} disabled={loading !== null || layoutExporting}>
                      <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onExportLayout(aiLayoutCanvasRef)}
                      disabled={loading !== null || layoutExporting || paneMode !== "ai-layout"}
                    >
                      {layoutExporting ? (
                        <Loader2 className="size-3.5 mr-1 animate-spin" />
                      ) : (
                        <Download className="size-3.5 mr-1" />
                      )}
                      Экспорт PNG
                    </Button>
                  </div>
                  <A4LayoutCanvas
                    ref={aiLayoutCanvasRef}
                    layout={aiLayoutCanvas}
                    active={paneMode === "ai-layout"}
                    profile={activeProfile}
                    exportKind="технический макет"
                    accentHighlightText={manualAccentHighlightText}
                  />
                  {aiLayoutResult ? (
                    <details className="rounded-md border border-border bg-background/60 p-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Показать ответ модели (JSON)
                      </summary>
                      <pre className="mt-2 overflow-auto text-xs">
                        {JSON.stringify(aiLayoutResult, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </>
              ) : (
                <EmptyState text="Создайте технический макет, чтобы увидеть ИИ-макет." />
              )}
            </TabsContent>

            <TabsContent value="image" className="p-2 space-y-2">
              {activeImage ? (
                <>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRefineStage("image")} disabled={loading !== null}>
                      <Sparkles className="size-3.5 mr-1" /> Изменить с ИИ
                    </Button>
                    <Button size="sm" variant="outline" onClick={onGenerateImage} disabled={loading !== null}>
                      <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
                    </Button>
                  </div>
                  <img src={activeImage.value} alt="Сгенерированная инфографика" className="w-full rounded-md border border-border" />
                </>
              ) : (
                <EmptyState text="Сгенерируйте итоговое изображение, чтобы увидеть его здесь." />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>
      </div>
      </div>

      <RefineDialog
        open={refineStage === "content"}
        title="Изменить содержание с ИИ"
        description="Опишите, какие изменения в содержании или группировке необходимо произвести. Модели будут переданы: текущий JSON анализа, список допустимых типов сущностей и ваши пожелания."
        busy={loading === "refine"}
        onCancel={() => setRefineStage(null)}
        onSubmit={onRefineContent}
      />
      <RefineDialog
        open={refineStage === "brief"}
        title="Изменить расположение блоков с ИИ"
        description={'Опишите, какие изменения в размещении блоков необходимо произвести.\nОбратите внимание, что для редактирования текста предпочтительно вернуться на вкладку «Контент».'}
        busy={loading === "refine"}
        onCancel={() => setRefineStage(null)}
        onSubmit={onRefineBrief}
      />
      <RefineDialog
        open={refineStage === "image"}
        title="Изменить изображение с ИИ"
        description={'Опишите, что изменить на изображении.\nОбратите внимание, что содержание и размещение блоков лучше менять на предыдущих этапах.'}
        busy={loading === "refine"}
        onCancel={() => setRefineStage(null)}
        onSubmit={onRefineImage}
      />

      <Dialog open={detectResult !== null} onOpenChange={(o) => { if (!o) setDetectResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Предложенный стиль: {detectResult?.styleName}</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap pt-2 text-sm text-foreground">
              {detectResult?.explanation}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDetectResult(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-10 text-center text-sm text-muted-foreground">{text}</div>
  );
}

function ProgrammaticPane({
  spec,
  loading,
  onRegenerate,
}: {
  spec: import("@/lib/render-spec/types").ProgrammaticRenderSpec;
  loading: boolean;
  onRegenerate: () => void;
}) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  async function exportPng() {
    const node = canvasWrapRef.current?.querySelector("[data-spec-canvas]") as HTMLElement | null;
    if (!node) return;
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `infographic-${Date.now()}.png`;
      a.click();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось экспортировать PNG");
    }
  }
  return (
    <>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={exportPng} disabled={loading}>
          Экспорт PNG
        </Button>
        <Button size="sm" variant="outline" onClick={onRegenerate} disabled={loading}>
          <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
        </Button>
      </div>
      <div ref={canvasWrapRef} className="rounded-md border border-border overflow-hidden">
        <ProgrammaticRenderer spec={spec} />
      </div>
      <details className="rounded-md border border-border bg-background/60 p-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Показать JSON-спецификацию
        </summary>
        <pre className="mt-2 overflow-auto text-xs max-h-96">
          {JSON.stringify(spec, null, 2)}
        </pre>
      </details>
    </>
  );
}
