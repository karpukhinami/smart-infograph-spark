import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  RotateCcw,
  RefreshCw,
  Upload,
  ImagePlus,
  Sparkles,
  ImageIcon,
  Download,
  Pencil,
  Info,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useProjectStore, useActiveContent } from "@/store/useProjectStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { callImageLLM } from "@/lib/llm-client";
import { callTextLLMForJson } from "@/lib/llm-json";
import { validateAnalysisJson } from "@/lib/analysis-render";
import { SimpleContentPreview } from "@/components/workspace/SimpleContentPreview";
import {
  buildDesignBriefPrompt,
  buildSimpleHomeImagePrompt,
  resolveDesignProfile,
} from "@/lib/prompt-injection";
import simpleBriefPromptRaw from "@/data/prompts/simple/design-brief-short.txt?raw";
import imagePromptHeaderText from "@/data/prompts/image-prompt-header.txt?raw";
import executionRulesText from "@/data/prompts/execution-rules.txt?raw";
import type { AnalysisJson, ContentSummary, DesignBriefResult, InfographicStyle } from "@/lib/types";
import { Markdown } from "@/components/workspace/Markdown";
import { ProfileSelect } from "@/components/design-profile/ProfileSelect";
import { SimpleImageRating } from "@/components/workspace/SimpleImageRating";
import { cn } from "@/lib/utils";
import { isAdminShellPath } from "@/lib/admin-shell";
import { HomeYandexMetrika } from "@/components/analytics/HomeYandexMetrika";
import { isHomeAnalyticsRoute } from "@/lib/analytics/yandex-metrika";
import {
  trackHomeContentSuccess,
  trackHomeEditModeEnter,
  trackHomeEditSave,
  trackHomeEditSaveAndRegenClick,
  trackHomeEditSaveAndRegenSuccess,
  trackHomeFormInputStart,
  trackHomeGenerateClick,
  trackHomeImageDownload,
  trackHomeImageFullscreen,
  trackHomeImageRate,
  trackHomeImageSuccess,
  trackHomeRegenContentClick,
  trackHomeRegenContentSuccess,
  trackHomeRegenImageClick,
  trackHomeRegenImageSuccess,
  trackHomeResetClick,
  trackHomeResetConfirm,
  trackHomeVersionSwitch,
} from "@/lib/analytics/home-events";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "AI Infographic Generator" }] }),
  component: SimpleHome,
});

const SUBJECTS = [
  "Математика",
  "Алгебра",
  "Геометрия",
  "Русский язык",
  "Литература",
  "Физика",
  "Химия",
  "Биология",
  "География",
  "История",
  "Обществознание",
  "Информатика",
  "Английский язык",
  "Окружающий мир",
  "Технология",
  "ИЗО",
  "Музыка",
  "Физкультура",
  "ОБЖ",
  "Астрономия",
  "Другое",
];
const GRADES = [...Array.from({ length: 11 }, (_, i) => String(i + 1)), "Другое"];

/** Home page always uses strict prompts/styles regardless of the global mode switch. */
const HOME_APP_MODE = "strict" as const;

const LAVENDER = "#A78BFA";

function RequiredStar() {
  return (
    <span aria-hidden className="ml-1 inline-block" style={{ color: LAVENDER }} title="Обязательное поле">
      ★
    </span>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function SimpleHomePageTitle({ className }: { className?: string }) {
  return (
    <h1 className={cn("text-4xl font-semibold tracking-tight", className)}>
      Генератор инфографики
    </h1>
  );
}

export function SimpleHome() {
  const source = useProjectStore((s) => s.source);
  const setSource = useProjectStore((s) => s.setSource);
  const resetProject = useProjectStore((s) => s.resetProject);
  const models = useProjectStore((s) => s.models);
  const pushContent = useProjectStore((s) => s.pushContent);
  const selectedStyleId = useProjectStore((s) => s.selectedStyleId);
  const selectedProfileName = useProjectStore((s) => s.selectedProfileName);
  const setSelectedProfileName = useProjectStore((s) => s.setSelectedProfileName);
  const userWishes = useProjectStore((s) => s.userWishes);
  const setUserWishes = useProjectStore((s) => s.setUserWishes);
  const attachedImages = useProjectStore((s) => s.attachedImages);
  const addAttachedImages = useProjectStore((s) => s.addAttachedImages);
  const removeAttachedImage = useProjectStore((s) => s.removeAttachedImage);
  const simpleCurrent = useProjectStore((s) => s.simpleCurrentImage);
  const simpleVersions = useProjectStore((s) => s.simpleImageVersions);
  const setSimpleCurrent = useProjectStore((s) => s.setSimpleCurrentImage);
  const archiveSimple = useProjectStore((s) => s.archiveSimpleCurrentImage);
  const swapSimpleVersion = useProjectStore((s) => s.swapSimpleVersion);
  const clearSimpleImages = useProjectStore((s) => s.clearSimpleImages);
  const replaceActiveAnalysis = useProjectStore((s) => s.replaceActiveAnalysis);

  const activeContent = useActiveContent();
  const prompts = useSettingsStore((s) => s.promptsByMode[HOME_APP_MODE]);
  const styles = useSettingsStore((s) => s.stylesByMode[HOME_APP_MODE]);
  const profiles = useSettingsStore((s) => s.profiles);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const allowNewDesignProfile = isAdminShellPath(pathname);
  const trackHome = isHomeAnalyticsRoute(pathname);
  const formInputStartedRef = useRef(false);

  function touchFormInput(inputName: string) {
    if (!trackHome || formInputStartedRef.current) return;
    formInputStartedRef.current = true;
    trackHomeFormInputStart(pathname, inputName);
  }

  const [loading, setLoading] = useState<null | "analyze" | "image">(null);
  const [imageStage, setImageStage] = useState<null | "brief" | "render">(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [paneMode, setPaneMode] = useState<"content" | "image">("image");
  const [editMode, setEditMode] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<AnalysisJson | null>(null);
  const [regenImageOpen, setRegenImageOpen] = useState(false);
  const [regenContentOpen, setRegenContentOpen] = useState(false);
  const [regenAfterEditOpen, setRegenAfterEditOpen] = useState(false);
  const [imageFullscreen, setImageFullscreen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const enabledStyles = useMemo<InfographicStyle[]>(() => styles.filter((s) => s.enabled), [styles]);
  const activeStyle = useMemo(
    () => styles.find((s) => s.id === (selectedStyleId ?? activeContent?.value.recommendedStyle)),
    [styles, selectedStyleId, activeContent],
  );
  const activeProfile = useMemo(
    () => profiles.find((p) => p.profileName === selectedProfileName) ?? profiles[0],
    [profiles, selectedProfileName],
  );

  const isDirty = useMemo(() => {
    if (!editMode || !editSnapshot || !activeContent?.value.analysis) return false;
    return JSON.stringify(activeContent.value.analysis) !== JSON.stringify(editSnapshot);
  }, [editMode, editSnapshot, activeContent?.value.analysis]);

  const hasSource = Boolean(source.text.trim());
  const useTopicOnlyPrompt = !hasSource;

  const subjectOk = Boolean(source.subject);
  const gradeOk = Boolean(source.grade);
  const canGenerate = subjectOk && gradeOk;

  const showResults = Boolean(activeContent) || loading !== null;
  const isBusy = loading !== null;

  useEffect(() => {
    if (!imageFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImageFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imageFullscreen]);

  useEffect(() => {
    if (!simpleCurrent) setImageFullscreen(false);
  }, [simpleCurrent?.id]);

  async function attachImageFiles(files: File[]) {
    if (!files.length) return;
    try {
      const dataUrls = await Promise.all(files.map(fileToDataUrl));
      addAttachedImages(dataUrls);
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
      touchFormInput("paste_image");
      await attachImageFiles(imageFiles);
    }
  }

  async function onFileChosen(files: FileList | null) {
    if (!files?.length) return;
    touchFormInput("file_upload");
    const arr = Array.from(files);
    const images = arr.filter((f) => f.type.startsWith("image/"));
    const texts = arr.filter((f) => !f.type.startsWith("image/"));
    for (const t of texts) {
      const text = await t.text();
      const cur = source.text.trim();
      setSource({ text: cur ? `${cur}\n\n${text}` : text });
    }
    if (images.length) await attachImageFiles(images);
  }

  // === Analysis ===
  async function runAnalyze(extraInstructions?: string): Promise<ContentSummary | null> {
    const stylesList = enabledStyles.map((s) => `- ${s.id}: ${s.name} — ${s.shortDescription}`).join("\n");
    const template = useTopicOnlyPrompt ? prompts.analysisTopicOnly : prompts.analysisWithContent;
    const baseInstructions = source.userInstructions || "";
    const merged = [baseInstructions, extraInstructions || ""].filter((s) => s && s.trim()).join("\n\n").trim();
    const filled = template
      .replaceAll("{{USER_INSTRUCTIONS}}", merged || "(нет)")
      .replaceAll("{{STYLES_LIST}}", stylesList || "(стилей не задано)")
      .replaceAll("{{SOURCE_TEXT}}", source.text || "")
      .replaceAll("{{TOPIC}}", source.topic || "")
      .replaceAll("{{SUBJECT}}", source.subject || "")
      .replaceAll("{{GRADE}}", source.grade || "")
      .replaceAll("{{EDUCATIONAL_ILLUSTRATIONS}}", source.educationalIllustrations ? "вкл" : "выкл")
      .replaceAll("{{NARRATIVE_ILLUSTRATIONS}}", source.narrativeIllustrations ? "вкл" : "выкл");

    const imgs = attachedImages.length ? attachedImages : undefined;
    const analysis = await callTextLLMForJson({
      model: models.analysis,
      prompt: filled,
      label: "analysis",
      parse: validateAnalysisJson,
      images: imgs,
    });
    const fallbackStyle = enabledStyles[0]?.id ?? "";
    const summary: ContentSummary = {
      content: "",
      recommendedStyle: selectedStyleId ?? fallbackStyle,
      recommendedDesignProfile: analysis.recommendedDesignProfile ?? null,
      analysis,
    };
    pushContent(summary);
    return summary;
  }

  // === Image ===
  async function runImage(opts: { useProfileName?: string | null } = {}): Promise<void> {
    const project = useProjectStore.getState();
    const settings = useSettingsStore.getState();
    const profiles = settings.profiles;
    const prompts = settings.promptsByMode[HOME_APP_MODE];
    const profile = resolveDesignProfile(
      profiles,
      opts.useProfileName ?? project.selectedProfileName,
    );
    const fallbackStyle = enabledStyles[0];
    const style = activeStyle ?? fallbackStyle;
    if (!style) throw new Error("Не задан стиль инфографики");
    const content = project.contentVersions.find((v) => v.id === project.activeContentId);
    if (!content) throw new Error("Контент не готов");

    setImageStage("brief");

    const summaryText = content.value.analysis
      ? JSON.stringify(content.value.analysis, null, 2)
      : content.value.content;

    const filled = buildDesignBriefPrompt({
      template: simpleBriefPromptRaw,
      contentSummary: summaryText,
      style,
      profile,
      userWishes: project.userWishes,
      generalRules: prompts.generalRules,
    });
    const briefRes = await callTextLLMForJson({
      model: project.models.brief,
      prompt: filled,
      label: "simple design brief",
      parse: (v) => v as DesignBriefResult,
    });
    if (!briefRes?.PromptForImageGeneration) throw new Error("Модель не вернула PromptForImageGeneration");

    const finalPrompt = buildSimpleHomeImagePrompt({
      profile,
      promptForImageGeneration: briefRes.PromptForImageGeneration,
      headerText: imagePromptHeaderText,
      executionRules: executionRulesText,
    });

    setImageStage("render");
    const dataUrl = await callImageLLM({ model: project.models.image, prompt: finalPrompt });
    archiveSimple();
    setSimpleCurrent({ dataUrl, prompt: finalPrompt });
  }

  // === One-shot: generate everything ===
  async function onGenerateAll() {
    if (!canGenerate) {
      toast.error("Заполните предмет и класс. Если нет подходящей опции, выберите «Другое».");
      return;
    }
    if (trackHome) {
      trackHomeGenerateClick(pathname, {
        has_source_text: hasSource,
        has_attached_images: attachedImages.length > 0,
        subject: source.subject || "",
        grade: source.grade || "",
        topic_length: (source.topic || "").length,
      });
    }
    try {
      setPaneMode("image");
      setLoading("analyze");
      const summary = await runAnalyze();
      if (!summary) return;
      if (trackHome) {
        trackHomeContentSuccess(pathname, {
          entity_count: summary.analysis?.entities?.length ?? 0,
          has_source_text: hasSource,
          generation_mode: hasSource ? "with_materials" : "topic_only",
        });
      }
      // pick profile from recommendation if user hasn't chosen one
      const recName = summary.recommendedDesignProfile;
      const useProfile = selectedProfileName ?? recName ?? null;
      if (!selectedProfileName && recName) setSelectedProfileName(recName);
      setLoading("image");
      await runImage({ useProfileName: useProfile });
      if (trackHome) {
        const img = useProjectStore.getState().simpleCurrentImage;
        trackHomeImageSuccess(pathname, {
          version_number: img?.versionNumber ?? 1,
          image_versions_count: useProjectStore.getState().simpleImageVersions.length,
          profile_name: useProfile ?? selectedProfileName ?? "",
          trigger: "initial",
        });
      }
      toast.success("Инфографика готова");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось сгенерировать");
    } finally {
      setLoading(null);
      setImageStage(null);
    }
  }

  // === Regenerate content (from results pane) ===
  async function onRegenContent(extraInstructions: string) {
    try {
      setRegenContentOpen(false);
      setLoading("analyze");
      setPaneMode("content");
      const summary = await runAnalyze(extraInstructions);
      if (trackHome && summary) {
        trackHomeRegenContentSuccess(pathname, {
          entity_count: summary.analysis?.entities?.length ?? 0,
          has_extra_instructions: Boolean(extraInstructions.trim()),
        });
      }
      toast.success("Контент обновлён");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось перегенерировать контент");
    } finally {
      setLoading(null);
    }
  }

  // === Regenerate image (from results pane) ===
  async function onRegenImage(profileName: string | null, wishes: string) {
    try {
      setRegenImageOpen(false);
      if (profileName) setSelectedProfileName(profileName);
      setUserWishes(wishes);
      setLoading("image");
      setPaneMode("image");
      await runImage({ useProfileName: profileName });
      if (trackHome) {
        const img = useProjectStore.getState().simpleCurrentImage;
        trackHomeRegenImageSuccess(pathname, {
          version_number: img?.versionNumber ?? 1,
          profile_name: profileName ?? selectedProfileName ?? "",
          has_wishes: Boolean(wishes.trim()),
        });
        trackHomeImageSuccess(pathname, {
          version_number: img?.versionNumber ?? 1,
          image_versions_count: useProjectStore.getState().simpleImageVersions.length,
          profile_name: profileName ?? selectedProfileName ?? "",
          trigger: "regen_image",
        });
      }
      toast.success("Изображение готово");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось перегенерировать изображение");
    } finally {
      setLoading(null);
      setImageStage(null);
    }
  }

  function onConfirmReset() {
    if (trackHome) trackHomeResetConfirm(pathname);
    formInputStartedRef.current = false;
    clearSimpleImages();
    resetProject();
    setResetOpen(false);
    setEditMode(false);
    setEditSnapshot(null);
    setPaneMode("image");
    toast.success("Проект сброшен");
  }

  function onEnterEditMode() {
    if (!activeContent?.value.analysis) return;
    if (trackHome) trackHomeEditModeEnter(pathname);
    setEditSnapshot(JSON.parse(JSON.stringify(activeContent.value.analysis)) as AnalysisJson);
    setEditMode(true);
  }
  function onSaveEdits() {
    if (trackHome) trackHomeEditSave(pathname);
    setEditSnapshot(null);
    setEditMode(false);
    toast.success("Изменения сохранены");
  }
  function onSaveAndRegen() {
    if (trackHome) trackHomeEditSaveAndRegenClick(pathname);
    // Save (changes are already applied to the store); exit edit mode and open regen dialog
    setEditSnapshot(null);
    setEditMode(false);
    setRegenAfterEditOpen(true);
  }
  function onCancelRegenAfterEdit() {
    // Return to active editing without reverting saved changes
    setRegenAfterEditOpen(false);
    onEnterEditMode();
  }
  async function onConfirmRegenAfterEdit(wishes: string) {
    try {
      setRegenAfterEditOpen(false);
      setUserWishes(wishes);
      setLoading("image");
      setPaneMode("image");
      await runImage({ useProfileName: selectedProfileName ?? activeProfile?.profileName ?? null });
      if (trackHome) {
        const img = useProjectStore.getState().simpleCurrentImage;
        trackHomeEditSaveAndRegenSuccess(pathname, {
          version_number: img?.versionNumber ?? 1,
          has_wishes: Boolean(wishes.trim()),
        });
        trackHomeImageSuccess(pathname, {
          version_number: img?.versionNumber ?? 1,
          image_versions_count: useProjectStore.getState().simpleImageVersions.length,
          profile_name: selectedProfileName ?? activeProfile?.profileName ?? "",
          trigger: "regen_after_edit",
        });
      }
      toast.success("Изображение готово");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось перегенерировать изображение");
    } finally {
      setLoading(null);
      setImageStage(null);
    }
  }
  function onResetEdits() {
    const current = activeContent?.value.analysis ?? null;
    const unchanged = editSnapshot && current && JSON.stringify(editSnapshot) === JSON.stringify(current);
    if (editSnapshot && !unchanged) replaceActiveAnalysis(editSnapshot);
    setEditSnapshot(null);
    setEditMode(false);
    if (!unchanged) toast.success("Изменения отменены");
  }


  const analysisJson = activeContent?.value.analysis ?? null;

  // ============ INPUT VIEW ============
  if (!showResults) {
    return (
      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-4 pt-8 pb-6">
        <HomeYandexMetrika />
        <SimpleHomePageTitle className="mb-6" />
        <section className="rounded-lg border border-border bg-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Данные инфографики</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (trackHome) trackHomeResetClick(pathname);
                setResetOpen(true);
              }}
            >
              <RotateCcw className="size-3.5 mr-1" /> Начать заново
            </Button>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-6">
              <Label className="text-xs">
                Предмет
                <RequiredStar />
              </Label>
              <Select
                value={source.subject || ""}
                onValueChange={(v) => {
                  touchFormInput("subject");
                  setSource({ subject: v });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите предмет" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-6">
              <Label className="text-xs">
                Класс
                <RequiredStar />
              </Label>
              <Select
                value={source.grade || ""}
                onValueChange={(v) => {
                  touchFormInput("grade");
                  setSource({ grade: v });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите класс" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-12">
              <Label className="text-xs">Тема</Label>
              <Input
                value={source.topic || ""}
                onChange={(e) => {
                  touchFormInput("topic");
                  setSource({ topic: e.target.value });
                }}
                placeholder="Что изучаем?"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Дополнительные инструкции</Label>
            <Textarea
              rows={2}
              value={source.userInstructions}
              onChange={(e) => {
                touchFormInput("user_instructions");
                setSource({ userInstructions: e.target.value });
              }}
              placeholder="На что сделать акцент, что пропустить, особенности аудитории…"
            />
          </div>

          <TooltipProvider delayDuration={150}>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="sw-edu"
                  checked={source.educationalIllustrations}
                  onCheckedChange={(v) => {
                    touchFormInput("educational_illustrations");
                    setSource({ educationalIllustrations: v });
                  }}
                />
                <Label htmlFor="sw-edu" className="text-sm font-normal cursor-pointer">
                  Учебные иллюстрации
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {source.educationalIllustrations
                      ? 'Иллюстрации, отражающие предметное содержание — чертежи, схемы, диаграммы — добавляются только в случае необходимости. Если хотите увидеть больше предметных иллюстраций, отметьте это в поле «Дополнительные инструкции».'
                      : 'Иллюстрации, отражающие предметное содержание — чертежи, схемы, диаграммы — запрещены.'}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="sw-narr"
                  checked={source.narrativeIllustrations}
                  onCheckedChange={(v) => {
                    touchFormInput("narrative_illustrations");
                    setSource({ narrativeIllustrations: v });
                  }}
                />
                <Label htmlFor="sw-narr" className="text-sm font-normal cursor-pointer">
                  Сюжетные иллюстрации
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {source.narrativeIllustrations
                      ? 'Иллюстрации развлекательного характера, призванные привлечь внимание ученика, добавляются умеренно на основе темы и класса. Если хотите более точно задать их содержание, отметьте это в поле «Дополнительные инструкции».'
                      : 'Иллюстрации развлекательного характера, призванные привлечь внимание ученика, отсутствуют.'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Исходный материал (необязательно)</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    touchFormInput("attach_file");
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload className="size-3.5 mr-1" /> Файл
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    touchFormInput("attach_image");
                    imageInputRef.current?.click();
                  }}
                >
                  <ImagePlus className="size-3.5 mr-1" /> Картинка
                </Button>
              </div>
            </div>
            <Textarea
              rows={6}
              placeholder="Вставьте текст или картинку (Ctrl/Cmd + V). Картинки уйдут в модель как мультимодальный вход."
              value={source.text}
              onChange={(e) => {
                touchFormInput("source_text");
                setSource({ text: e.target.value });
              }}
              onPaste={onPasteCapture}
            />
            {attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedImages.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="size-16 object-cover rounded border" />
                    <button
                      type="button"
                      onClick={() => removeAttachedImage(i)}
                      className="absolute -top-1 -right-1 size-5 rounded-full bg-background border text-xs leading-none"
                      title="Убрать"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void onFileChosen(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void onFileChosen(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <Button onClick={onGenerateAll} disabled={!canGenerate} className="w-full">
            <Sparkles className="size-4 mr-2" />
            Сгенерировать инфографику
          </Button>
        </section>

        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
              <AlertDialogDescription>
                Все сгенерированные изображения будут уничтожены, проект полностью сбросится.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirmReset}>ОК</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ============ RESULTS VIEW ============
  const sidebarVersions = useMemo(
    () =>
      [...simpleVersions].sort(
        (a, b) =>
          (a.versionNumber ?? Number.MAX_SAFE_INTEGER) - (b.versionNumber ?? Number.MAX_SAFE_INTEGER) ||
          a.createdAt - b.createdAt,
      ),
    [simpleVersions],
  );
  const currentVerLabel = simpleCurrent
    ? `ver.${simpleCurrent.versionNumber ?? sidebarVersions.length + 1}`
    : "ver.1";

  return (
    <TooltipProvider delayDuration={150}>
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 basis-0 flex-col overflow-hidden px-4 py-3">
      <HomeYandexMetrika />
      <div className="mb-3 flex shrink-0 items-center justify-between gap-4">
        <SimpleHomePageTitle className="text-3xl" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (trackHome) trackHomeResetClick(pathname);
            setResetOpen(true);
          }}
          disabled={editMode || isBusy}
        >
          <RotateCcw className="size-3.5 mr-1" /> Начать заново
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 basis-0 grid-cols-1 gap-3 max-lg:grid-rows-2 lg:grid-cols-2">
        {/* IMAGE PANEL */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 min-h-12">
            <h2 className="text-sm font-semibold text-muted-foreground">Итоговое изображение</h2>
            {simpleCurrent && !isBusy && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const title = analysisJson?.topic?.trim() || source.topic?.trim() || "без названия";
                    const safe = title.replace(/[\\/:*?"<>|]+/g, "").slice(0, 120);
                    const a = document.createElement("a");
                    a.href = simpleCurrent.dataUrl;
                    a.download = `инфографика: ${safe}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    if (trackHome) {
                      trackHomeImageDownload(pathname, {
                        version_number: simpleCurrent.versionNumber ?? 1,
                      });
                    }
                  }}
                >
                  <Download className="size-3.5 mr-1" /> Сохранить
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (trackHome) trackHomeRegenImageClick(pathname);
                        setRegenImageOpen(true);
                      }}
                    >
                      <RefreshCw className="size-3.5 mr-1" /> Перегенерировать изображение
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">Текстовое содержание не изменится</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-2">
            <div className="flex min-h-0 flex-1 gap-2">
              {simpleVersions.length > 0 && !isBusy && (
                <aside className="flex w-[4.5rem] shrink-0 flex-col overflow-hidden rounded-md border border-border bg-muted/40">
                  <div className="shrink-0 border-b border-border px-1 py-1.5 text-center text-[10px] leading-tight text-muted-foreground">
                    <div className="font-medium">Версии</div>
                    <div>сейчас {currentVerLabel}</div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
                    {sidebarVersions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          if (trackHome && simpleCurrent) {
                            trackHomeVersionSwitch(pathname, {
                              from_version: simpleCurrent.versionNumber ?? 1,
                              to_version: v.versionNumber ?? 1,
                            });
                          }
                          swapSimpleVersion(v.id);
                        }}
                        className="group relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded border hover:ring-2 hover:ring-ring"
                        title={`Открыть ver.${v.versionNumber ?? "?"}`}
                      >
                        <img src={v.dataUrl} alt="" className="h-full w-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] text-white">
                          ver.{v.versionNumber ?? "?"}
                        </span>
                      </button>
                    ))}
                  </div>
                </aside>
              )}

              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                  {loading === "analyze" ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                      <Loader2 className="size-8 animate-spin" />
                      <div>Шаг 1 из 2 — формируем контент…</div>
                    </div>
                  ) : loading === "image" ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                      <Loader2 className="size-8 animate-spin" />
                      <div>
                        {imageStage === "brief"
                          ? "Шаг 2 из 2 — составляем дизайн-бриф…"
                          : "Шаг 2 из 2 — генерируем изображение…"}
                      </div>
                    </div>
                  ) : simpleCurrent ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (trackHome && simpleCurrent) {
                          trackHomeImageFullscreen(pathname, {
                            version_number: simpleCurrent.versionNumber ?? 1,
                          });
                        }
                        setImageFullscreen(true);
                      }}
                      className="flex h-full w-full cursor-zoom-in items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Открыть на весь экран"
                    >
                      <img
                        src={simpleCurrent.dataUrl}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                      <ImageIcon className="size-8 opacity-50" />
                      Итоговое изображение появится здесь
                    </div>
                  )}
                </div>

                {simpleCurrent && !isBusy && (
                  <div className="shrink-0">
                    <SimpleImageRating
                      imageId={simpleCurrent.id}
                      onRate={
                        trackHome
                          ? (rating) =>
                              trackHomeImageRate(pathname, {
                                version_number: simpleCurrent.versionNumber ?? 1,
                                rating,
                              })
                          : undefined
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CONTENT PANEL */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 min-h-12">
            <h2 className="text-sm font-semibold text-muted-foreground">Контент</h2>
            {activeContent && !isBusy && (
              <div className="flex flex-wrap gap-2">
                {editMode ? (
                  <>
                    <Button variant="outline" size="sm" onClick={onResetEdits}>
                      Сбросить изменения
                    </Button>
                    <Button variant="outline" size="sm" onClick={onSaveEdits}>
                      Сохранить без перегенерации
                    </Button>
                    <Button
                      size="sm"
                      onClick={onSaveAndRegen}
                      disabled={!isDirty}
                    >
                      <Sparkles className="size-3.5 mr-1" />
                      Сохранить и сгенерировать инфографику
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={onEnterEditMode}>
                      <Pencil className="size-3.5 mr-1" /> Редактировать вручную
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (trackHome) trackHomeRegenContentClick(pathname);
                            setRegenContentOpen(true);
                          }}
                        >
                          <RefreshCw className="size-3.5 mr-1" /> Перегенерировать контент
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Без генерации изображения</TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            )}
          </div>

          {editMode && (
            <div className="shrink-0 space-y-1.5 border-b border-border px-5 py-3">
              <Label className="text-xs">Цветовая схема</Label>
              <ProfileSelect
                value={selectedProfileName ?? activeProfile?.profileName ?? ""}
                onChange={setSelectedProfileName}
                allowCreate={allowNewDesignProfile}
              />
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <div className="rounded-md border border-border bg-background p-4">
              {loading === "analyze" && !activeContent ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : loading === "analyze" ? (
                <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                  Перегенерируем контент…
                </div>
              ) : activeContent ? (
                analysisJson ? (
                  <SimpleContentPreview
                    analysis={analysisJson}
                    profile={activeProfile ?? null}
                    editable={editMode}
                  />
                ) : (
                  <Markdown>{activeContent.value.content}</Markdown>
                )
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {imageFullscreen && simpleCurrent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Изображение на весь экран"
          onClick={() => setImageFullscreen(false)}
        >
          <img
            src={simpleCurrent.dataUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}


      {/* Reset confirm */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Все сгенерированные изображения будут уничтожены, проект полностью сбросится.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmReset}>ОК</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RegenerateImageDialog
        open={regenImageOpen}
        initialProfile={selectedProfileName ?? activeProfile?.profileName ?? ""}
        initialWishes={userWishes}
        allowCreate={allowNewDesignProfile}
        onClose={() => setRegenImageOpen(false)}
        onConfirm={onRegenImage}
      />

      <RegenerateContentDialog
        open={regenContentOpen}
        onClose={() => setRegenContentOpen(false)}
        onConfirm={onRegenContent}
        subject={source.subject || ""}
        grade={source.grade || ""}
        topic={source.topic || ""}
        basedOn={hasSource ? "materials" : "topic"}
      />

      <RegenerateAfterEditDialog
        open={regenAfterEditOpen}
        onCancel={onCancelRegenAfterEdit}
        onConfirm={onConfirmRegenAfterEdit}
      />
    </div>
    </TooltipProvider>
  );
}




// ============== Regenerate Image Dialog ==============
function RegenerateImageDialog({
  open,
  initialProfile,
  initialWishes,
  allowCreate,
  onClose,
  onConfirm,
}: {
  open: boolean;
  initialProfile: string;
  initialWishes: string;
  allowCreate: boolean;
  onClose: () => void;
  onConfirm: (profileName: string | null, wishes: string) => void;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [wishes, setWishes] = useState(initialWishes);

  // sync incoming initial values when reopened
  useEffect(() => {
    if (open) {
      setProfile(initialProfile);
      setWishes(initialWishes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Перегенерация изображения</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Перегенерация идёт на основе содержимого вкладки «Контент» без учёта текущей генерации изображения;
            если хотите поменять содержимое инфографики, перейдите на вкладку «Контент».
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Цветовая схема</Label>
            <ProfileSelect value={profile} onChange={setProfile} allowCreate={allowCreate} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Дополнительные требования к изображению</Label>
            <Textarea
              rows={3}
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
              placeholder="Например: вынести формулу крупно, добавить иконку треугольника…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={() => onConfirm(profile || null, wishes)}>
            <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Regenerate Content Dialog ==============
function RegenerateContentDialog({
  open,
  onClose,
  onConfirm,
  subject,
  grade,
  topic,
  basedOn,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (extraInstructions: string) => void;
  subject: string;
  grade: string;
  topic: string;
  basedOn: "topic" | "materials";
}) {
  const [extra, setExtra] = useState("");
  const [paramsOpen, setParamsOpen] = useState(false);
  useEffect(() => {
    if (open) {
      setExtra("");
      setParamsOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Перегенерация контента</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Перегенерация контента производится на основе введённых ранее параметров и прикреплённых материалов;
            если вы хотите изменить их, нажмите «Начать заново».
          </p>
          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setParamsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40"
            >
              <span>Параметры исходной генерации</span>
              <span>{paramsOpen ? "▲" : "▼"}</span>
            </button>
            {paramsOpen && (
              <div className="px-3 pb-3 pt-1 text-xs space-y-1 text-muted-foreground">
                <div><span className="font-medium text-foreground">Предмет:</span> {subject || "—"}</div>
                <div><span className="font-medium text-foreground">Класс:</span> {grade || "—"}</div>
                <div><span className="font-medium text-foreground">Тема:</span> {topic || "—"}</div>
                <div className="italic">
                  {basedOn === "materials"
                    ? "генерация на основе прикреплённых материалов"
                    : "генерация по теме"}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Дополнительные инструкции</Label>
            <Textarea
              rows={4}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Что подправить, на что сделать акцент…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={() => onConfirm(extra)}>
            <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Regenerate Image After Edit Dialog ==============
function RegenerateAfterEditDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (wishes: string) => void;
}) {
  const [wishes, setWishes] = useState("");
  useEffect(() => {
    if (open) setWishes("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Перегенерация изображения</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Перегенерация изображения на основе внесённых в содержание инфографики изменений.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Дополнительные требования к изображению</Label>
            <Textarea
              rows={3}
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
              placeholder="Например: вынести формулу крупно, добавить иконку треугольника…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Отмена</Button>
          <Button onClick={() => onConfirm(wishes)}>
            <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
