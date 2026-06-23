import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import { useProjectStore, useActiveContent } from "@/store/useProjectStore";
import { useSettingsStore, useCurrentStyles } from "@/store/useSettingsStore";
import { callTextLLM, callImageLLM } from "@/lib/llm-client";
import { callTextLLMForJson } from "@/lib/llm-json";
import { validateAnalysisJson } from "@/lib/analysis-render";
import { SimpleContentPreview } from "@/components/workspace/SimpleContentPreview";
import { buildDesignBriefPrompt, designProfileColorsAndRules } from "@/lib/prompt-injection";
import simpleBriefPromptRaw from "@/data/prompts/simple/design-brief-short.txt?raw";
import executionRulesText from "@/data/prompts/execution-rules.txt?raw";
import type { AnalysisJson, ContentSummary, DesignBriefResult, InfographicStyle } from "@/lib/types";
import { Markdown } from "@/components/workspace/Markdown";
import { ProfileSelect } from "@/components/design-profile/ProfileSelect";

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

function SimpleHome() {
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
  const mode = useSettingsStore((s) => s.mode);
  const prompts = useSettingsStore((s) => s.promptsByMode[s.mode]);
  const styles = useCurrentStyles();
  const profiles = useSettingsStore((s) => s.profiles);

  const [loading, setLoading] = useState<null | "analyze" | "image">(null);
  const [imageStage, setImageStage] = useState<null | "brief" | "render">(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [paneMode, setPaneMode] = useState<"content" | "image">("image");
  const [editMode, setEditMode] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<AnalysisJson | null>(null);
  const [regenImageOpen, setRegenImageOpen] = useState(false);
  const [regenContentOpen, setRegenContentOpen] = useState(false);
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

  const hasSource = Boolean(source.text.trim());
  const useTopicOnlyPrompt = !hasSource;

  const subjectOk = Boolean(source.subject);
  const gradeOk = Boolean(source.grade);
  const canGenerate = subjectOk && gradeOk;

  const showResults = Boolean(activeContent) || loading !== null;
  const isBusy = loading !== null;

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
      await attachImageFiles(imageFiles);
    }
  }

  async function onFileChosen(files: FileList | null) {
    if (!files?.length) return;
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
      .replaceAll("{{GRADE}}", source.grade || "");

    const imgs = attachedImages.length ? attachedImages : undefined;
    let summary: ContentSummary;
    if (mode === "strict") {
      const analysis = await callTextLLMForJson({
        model: models.analysis,
        prompt: filled,
        label: "analysis",
        parse: validateAnalysisJson,
        images: imgs,
      });
      const fallbackStyle = enabledStyles[0]?.id ?? "";
      summary = {
        content: "",
        recommendedStyle: selectedStyleId ?? fallbackStyle,
        recommendedDesignProfile: analysis.recommendedDesignProfile ?? null,
        analysis,
      };
    } else {
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
    return summary;
  }

  // === Image ===
  async function runImage(opts: { useProfileName?: string | null } = {}): Promise<void> {
    const profileName = opts.useProfileName ?? selectedProfileName ?? activeProfile?.profileName ?? null;
    const profile = profiles.find((p) => p.profileName === profileName) ?? activeProfile;
    const fallbackStyle = enabledStyles[0];
    const style = activeStyle ?? fallbackStyle;
    if (!style) throw new Error("Не задан стиль инфографики");
    const content = useProjectStore.getState().contentVersions.find(
      (v) => v.id === useProjectStore.getState().activeContentId,
    );
    if (!content) throw new Error("Контент не готов");

    setImageStage("brief");
    archiveSimple();

    const summaryText = content.value.analysis
      ? JSON.stringify(content.value.analysis, null, 2)
      : content.value.content;

    const filled = buildDesignBriefPrompt({
      template: simpleBriefPromptRaw,
      contentSummary: summaryText,
      style,
      profile,
      userWishes,
      generalRules: prompts.generalRules,
    });
    const briefRes = await callTextLLMForJson({
      model: models.brief,
      prompt: filled,
      label: "simple design brief",
      parse: (v) => v as DesignBriefResult,
    });
    if (!briefRes?.PromptForImageGeneration) throw new Error("Модель не вернула PromptForImageGeneration");

    const layer1 = mode === "strict" ? designProfileColorsAndRules(profile) : "";
    const finalPrompt = [layer1, briefRes.PromptForImageGeneration, executionRulesText]
      .filter((s) => s && s.trim().length > 0)
      .join("\n\n");

    setImageStage("render");
    const dataUrl = await callImageLLM({ model: models.image, prompt: finalPrompt });
    setSimpleCurrent({ dataUrl, prompt: finalPrompt });
  }

  // === One-shot: generate everything ===
  async function onGenerateAll() {
    if (!canGenerate) {
      toast.error("Заполните предмет и класс. Если нет подходящей опции, выберите «Другое».");
      return;
    }
    try {
      setPaneMode("image");
      setLoading("analyze");
      const summary = await runAnalyze();
      if (!summary) return;
      // pick profile from recommendation if user hasn't chosen one
      const recName = summary.recommendedDesignProfile;
      const useProfile = selectedProfileName ?? recName ?? null;
      if (!selectedProfileName && recName) setSelectedProfileName(recName);
      setLoading("image");
      await runImage({ useProfileName: useProfile });
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
      await runAnalyze(extraInstructions);
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
      toast.success("Изображение готово");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось перегенерировать изображение");
    } finally {
      setLoading(null);
      setImageStage(null);
    }
  }

  function onConfirmReset() {
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
    setEditSnapshot(JSON.parse(JSON.stringify(activeContent.value.analysis)) as AnalysisJson);
    setEditMode(true);
  }
  function onSaveEdits() {
    setEditSnapshot(null);
    setEditMode(false);
    toast.success("Изменения сохранены");
  }
  function onResetEdits() {
    if (editSnapshot) replaceActiveAnalysis(editSnapshot);
    setEditSnapshot(null);
    setEditMode(false);
    toast.success("Изменения отменены");
  }

  const analysisJson = activeContent?.value.analysis ?? null;

  // ============ INPUT VIEW ============
  if (!showResults) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <section className="rounded-lg border border-border bg-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Данные инфографики</h1>
            <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
              <RotateCcw className="size-3.5 mr-1" /> Начать заново
            </Button>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12">
              <Label className="text-xs">Тема</Label>
              <Input
                value={source.topic || ""}
                onChange={(e) => setSource({ topic: e.target.value })}
                placeholder="Что изучаем?"
              />
            </div>
            <div className="col-span-6">
              <Label className="text-xs">
                Предмет
                <RequiredStar />
              </Label>
              <Select value={source.subject || ""} onValueChange={(v) => setSource({ subject: v })}>
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
              <Select value={source.grade || ""} onValueChange={(v) => setSource({ grade: v })}>
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
          </div>

          <div>
            <Label className="text-xs">Дополнительные инструкции</Label>
            <Textarea
              rows={2}
              value={source.userInstructions}
              onChange={(e) => setSource({ userInstructions: e.target.value })}
              placeholder="На что сделать акцент, что пропустить, особенности аудитории…"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Исходный материал (необязательно)</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3.5 mr-1" /> Файл
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImagePlus className="size-3.5 mr-1" /> Картинка
                </Button>
              </div>
            </div>
            <Textarea
              rows={6}
              placeholder="Вставьте текст или картинку (Ctrl/Cmd + V). Картинки уйдут в модель как мультимодальный вход."
              value={source.text}
              onChange={(e) => setSource({ text: e.target.value })}
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
  const currentVerLabel = `ver.${simpleVersions.length + 1}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-4">
      <Tabs value={paneMode} onValueChange={(v) => setPaneMode(v as "content" | "image")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="content" disabled={!activeContent && loading !== "analyze"}>
              Контент
            </TabsTrigger>
            <TabsTrigger value="image" disabled={editMode}>
              Итоговое изображение
            </TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetOpen(true)}
            disabled={editMode || isBusy}
          >
            <RotateCcw className="size-3.5 mr-1" /> Начать заново
          </Button>
        </div>

        {/* CONTENT TAB */}
        <TabsContent value="content" className="mt-3">
          <section className="rounded-lg border border-border bg-card p-5 space-y-3">
            {editMode && (
              <div className="space-y-1.5">
                <Label className="text-xs">Цветовая схема</Label>
                <ProfileSelect
                  value={selectedProfileName ?? activeProfile?.profileName ?? ""}
                  onChange={setSelectedProfileName}
                />
              </div>
            )}

            <div className="rounded-md border border-border bg-background p-4 min-h-[200px]">
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

            {activeContent && !isBusy && (
              <div className="flex flex-wrap gap-2 justify-end pt-1">
                {editMode ? (
                  <>
                    <Button variant="outline" onClick={onResetEdits}>
                      Сбросить изменения
                    </Button>
                    <Button onClick={onSaveEdits}>Сохранить изменения</Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={onEnterEditMode}>
                      <Pencil className="size-3.5 mr-1" /> Редактировать вручную
                    </Button>
                    <Button variant="outline" onClick={() => setRegenContentOpen(true)}>
                      <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
                    </Button>
                  </>
                )}
              </div>
            )}
          </section>
        </TabsContent>

        {/* IMAGE TAB */}
        <TabsContent value="image" className="mt-3">
          <section className="rounded-lg border border-border bg-card p-5 space-y-3">
            <div className="rounded-md border border-border bg-background min-h-[320px] flex items-center justify-center overflow-hidden">
              {loading === "analyze" ? (
                <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                  <div>Шаг 1 из 2 — формируем контент…</div>
                </div>
              ) : loading === "image" ? (
                <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                  <div>
                    {imageStage === "brief"
                      ? "Шаг 2 из 2 — составляем дизайн-бриф…"
                      : "Шаг 2 из 2 — генерируем изображение…"}
                  </div>
                </div>
              ) : simpleCurrent ? (
                <img src={simpleCurrent.dataUrl} alt="" className="max-w-full max-h-[80vh]" />
              ) : (
                <div className="text-sm text-muted-foreground flex flex-col items-center gap-2 py-12">
                  <ImageIcon className="size-8 opacity-50" />
                  Итоговое изображение появится здесь
                </div>
              )}
            </div>

            {simpleCurrent && !isBusy && (
              <div className="flex flex-wrap gap-2 justify-end">
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
                  }}
                >
                  <Download className="size-3.5 mr-1" /> Сохранить
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRegenImageOpen(true)}>
                  <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
                </Button>
              </div>
            )}

            {simpleVersions.length > 0 && (
              <div className="rounded-md bg-muted/40 border border-border p-3 space-y-2">
                <div className="text-xs text-muted-foreground">
                  Предыдущие версии · текущая: {currentVerLabel}
                </div>
                <div className="flex flex-wrap gap-2">
                  {simpleVersions.map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => swapSimpleVersion(v.id)}
                      className="size-16 rounded border overflow-hidden relative group hover:ring-2 hover:ring-ring"
                      title={`Открыть ver.${i + 1}`}
                    >
                      <img src={v.dataUrl} alt="" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-white text-center py-0.5">
                        ver.{i + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

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
        onClose={() => setRegenImageOpen(false)}
        onConfirm={onRegenImage}
      />

      <RegenerateContentDialog
        open={regenContentOpen}
        onClose={() => setRegenContentOpen(false)}
        onConfirm={onRegenContent}
      />
    </div>
  );
}

// ============== Regenerate Image Dialog ==============
function RegenerateImageDialog({
  open,
  initialProfile,
  initialWishes,
  onClose,
  onConfirm,
}: {
  open: boolean;
  initialProfile: string;
  initialWishes: string;
  onClose: () => void;
  onConfirm: (profileName: string | null, wishes: string) => void;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [wishes, setWishes] = useState(initialWishes);

  // sync incoming initial values when reopened
  useMemo(() => {
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
            <ProfileSelect value={profile} onChange={setProfile} />
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
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (extraInstructions: string) => void;
}) {
  const [extra, setExtra] = useState("");
  useMemo(() => {
    if (open) setExtra("");
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
