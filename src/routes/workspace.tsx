import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, RotateCcw, Upload, Sparkles } from "lucide-react";
import { useProjectStore, useActiveContent, useActiveBrief, useActiveImage, useActiveSpec } from "@/store/useProjectStore";
import { useSettingsStore, useCurrentPrompts, useCurrentStyles } from "@/store/useSettingsStore";
import { ModelPicker } from "@/components/workspace/ModelPicker";
import { PromptDisclosure } from "@/components/workspace/PromptDisclosure";
import { Markdown } from "@/components/workspace/Markdown";
import { SimpleContentPreview } from "@/components/workspace/SimpleContentPreview";
import { WireframeView } from "@/components/workspace/WireframeView";
import { RefineDialog } from "@/components/workspace/RefineDialog";
import { callTextLLM, callImageLLM } from "@/lib/llm-client";
import { HelpFiles } from "@/components/workspace/HelpFiles";
import { callTextLLMForJson } from "@/lib/llm-json";
import { buildDesignBriefPrompt, designProfileColorsAndRules } from "@/lib/prompt-injection";
import { renderAnalysisJson, validateAnalysisJson } from "@/lib/analysis-render";
import {
  buildRefineContentPrompt,
  buildRefineBriefPrompt,
  buildRefineImageDecisionPrompt,
} from "@/lib/refine-prompts";
// recognize-image prompt no longer used: images are passed multimodally to the analysis model.
import executionRulesText from "@/data/prompts/execution-rules.txt?raw";
import type { ContentSummary, DesignBriefResult, InfographicStyle, PaneMode } from "@/lib/types";
import { validateRenderSpec } from "@/lib/render-spec/validate";
import { ProgrammaticRenderer } from "@/components/render-spec/ProgrammaticRenderer";
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
  const pushSpec = useProjectStore((s) => s.pushSpec);
  const attachedImages = useProjectStore((s) => s.attachedImages);
  const addAttachedImages = useProjectStore((s) => s.addAttachedImages);
  const uploadedSourceText = useProjectStore((s) => s.uploadedSourceText);
  const setUploadedSourceText = useProjectStore((s) => s.setUploadedSourceText);


  const activeContent = useActiveContent();
  const activeBrief = useActiveBrief();
  const activeImage = useActiveImage();
  const activeSpec = useActiveSpec();

  const mode = useSettingsStore((s) => s.mode);
  const prompts = useCurrentPrompts();
  const setPrompt = useSettingsStore((s) => s.setPrompt);
  const styles = useCurrentStyles();
  const profiles = useSettingsStore((s) => s.profiles);

  const [paneMode, setPaneMode] = useState<PaneMode>("content");
  const [loading, setLoading] = useState<null | "analyze" | "brief" | "image" | "recognize" | "refine">(null);
  const [refineStage, setRefineStage] = useState<null | "content" | "brief" | "image">(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const enabledStyles = useMemo<InfographicStyle[]>(() => styles.filter((s) => s.enabled), [styles]);
  const activeStyle = useMemo(
    () => styles.find((s) => s.id === (selectedStyleId ?? activeContent?.value.recommendedStyle)),
    [styles, selectedStyleId, activeContent],
  );
  const activeProfile = useMemo(
    () => profiles.find((p) => p.profileName === selectedProfileName) ?? profiles[0],
    [profiles, selectedProfileName],
  );

  const hasSource = hasSourceMaterials(source.text, uploadedSourceText, attachedImages);
  const useTopicOnlyPrompt = !hasSource;

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


  async function onAnalyze() {
    try {
      setLoading("analyze");
      const stylesList = enabledStyles.map((s) => `- ${s.id}: ${s.name} — ${s.shortDescription}`).join("\n");
      const template = useTopicOnlyPrompt ? prompts.analysisTopicOnly : prompts.analysisWithContent;
      const filled = template
        .replaceAll("{{USER_INSTRUCTIONS}}", source.userInstructions || "(нет)")
        .replaceAll("{{STYLES_LIST}}", stylesList || "(стилей не задано)")
        .replaceAll("{{SOURCE_TEXT}}", buildSourceTextForPrompt(source.text, uploadedSourceText) || "")
        .replaceAll("{{TOPIC}}", source.topic || "")
        .replaceAll("{{SUBJECT}}", source.subject || "")
        .replaceAll("{{GRADE}}", source.grade || "");

      let summary: ContentSummary;
      const imgs = attachedImages.length ? attachedImages : undefined;
      if (mode === "strict") {
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

  async function onCreateProgrammaticSpec() {
    if (!activeContent) return;
    if (!activeStyle) { toast.error("Сначала выберите стиль"); return; }
    try {
      setLoading("brief");
      const filled = buildDesignBriefPrompt({
        template: prompts.codeBasedProduct,
        contentSummary: activeContent.value.content,
        style: activeStyle,
        profile: activeProfile,
        userWishes,
        generalRules: prompts.generalRules,
      });
      const raw = await callTextLLMForJson({
        model: models.brief,
        prompt: filled,
        label: "render spec",
        schemaHint: 'Верни JSON-объект формы { "ProgrammaticRenderSpec": { "format": {...}, "theme": {...}, "header": {...}, "rows": [...] } }.',
        parse: (value) => value as unknown,
      });
      const { spec, warnings } = validateRenderSpec(raw, activeProfile ?? null);
      pushSpec(spec);
      setPaneMode("wireframe");
      if (warnings.length) {
        toast.message("Технический макет создан с предупреждениями", { description: warnings.slice(0, 3).join("\n") });
      } else {
        toast.success("Технический макет создан");
      }
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
                  value={selectedProfileName ?? activeProfile?.profileName ?? ""}
                  onChange={setSelectedProfileName}
                />
              </div>
            </div>
            {mode === "strict" && briefMode === "programmatic" ? (
              <>
                <PromptDisclosure
                  label="Показать промпт технического макета"
                  value={prompts.codeBasedProduct}
                  onChange={(v) => setPrompt("codeBasedProduct", v)}
                  rightSlot={<ModelPicker kind="text" value={models.brief} onChange={(v) => setModel("brief", v)} />}
                />
                <div>
                  <Button onClick={onCreateProgrammaticSpec} disabled={loading !== null}>
                    {loading === "brief" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
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
              <TabsTrigger value="wireframe" disabled={!activeBrief && !activeSpec}>Каркас</TabsTrigger>
              <TabsTrigger value="image" disabled={!activeImage}>Итоговое изображение</TabsTrigger>
            </TabsList>

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
                    {activeContent.value.analysis ? (
                      <SimpleContentPreview analysis={activeContent.value.analysis} profile={activeProfile ?? null} />
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

            <TabsContent value="wireframe" className="p-2 space-y-2">
              {mode === "strict" && briefMode === "programmatic" && activeSpec ? (
                <ProgrammaticPane
                  spec={activeSpec.value}
                  loading={loading !== null}
                  onRegenerate={onCreateProgrammaticSpec}
                />
              ) : activeBrief ? (
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
                <EmptyState text="Создайте дизайн-бриф или технический макет, чтобы увидеть каркас." />
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
