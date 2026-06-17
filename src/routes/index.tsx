import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Loader2, RotateCcw, RefreshCw, Upload, ImagePlus, Sparkles, ImageIcon } from "lucide-react";
import { useProjectStore, useActiveContent } from "@/store/useProjectStore";
import { useSettingsStore, useCurrentStyles } from "@/store/useSettingsStore";
import { callTextLLM, callImageLLM } from "@/lib/llm-client";
import { callTextLLMForJson } from "@/lib/llm-json";
import { validateAnalysisJson } from "@/lib/analysis-render";
import { renderSimpleSummary } from "@/lib/simple-content-render";
import { buildDesignBriefPrompt, designProfileColorsAndRules } from "@/lib/prompt-injection";
import simpleBriefPromptRaw from "@/data/prompts/simple/design-brief-short.txt?raw";
import executionRulesText from "@/data/prompts/execution-rules.txt?raw";
import type { ContentSummary, DesignBriefResult, InfographicStyle } from "@/lib/types";
import { Markdown } from "@/components/workspace/Markdown";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "AI Infographic Generator" }] }),
  component: SimpleHome,
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

function SimpleHome() {
  const source = useProjectStore((s) => s.source);
  const setSource = useProjectStore((s) => s.setSource);
  const resetProject = useProjectStore((s) => s.resetProject);
  const models = useProjectStore((s) => s.models);
  const pushContent = useProjectStore((s) => s.pushContent);
  const selectedStyleId = useProjectStore((s) => s.selectedStyleId);
  const setSelectedStyleId = useProjectStore((s) => s.setSelectedStyleId);
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
  const clearSimpleImages = useProjectStore((s) => s.clearSimpleImages);

  const activeContent = useActiveContent();
  const mode = useSettingsStore((s) => s.mode);
  const prompts = useSettingsStore((s) => s.promptsByMode[s.mode]);
  const styles = useCurrentStyles();
  const profiles = useSettingsStore((s) => s.profiles);

  const [loading, setLoading] = useState<null | "analyze" | "image">(null);
  const [imageStage, setImageStage] = useState<null | "brief" | "render">(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<string | null>(null);
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

  async function onAnalyze() {
    try {
      setLoading("analyze");
      // Перегенерация контента обнуляет все следующие шаги: текущее изображение архивируется,
      // выбранный профиль/стиль сбрасываются, чтобы вновь подтянулись рекомендации модели.
      archiveSimple();
      const stylesList = enabledStyles.map((s) => `- ${s.id}: ${s.name} — ${s.shortDescription}`).join("\n");
      const template = useTopicOnlyPrompt ? prompts.analysisTopicOnly : prompts.analysisWithContent;
      const filled = template
        .replaceAll("{{USER_INSTRUCTIONS}}", source.userInstructions || "(нет)")
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
      toast.success("Контент готов");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось выполнить анализ");
    } finally {
      setLoading(null);
    }
  }

  async function onGenerateImage() {
    if (!activeContent) return;
    if (!activeStyle) { toast.error("Выберите стиль"); return; }
    try {
      setLoading("image");
      setImageStage("brief");
      archiveSimple();

      // Шаг A: укороченный бриф → PromptForImageGeneration
      const summaryText =
        activeContent.value.analysis
          ? JSON.stringify(activeContent.value.analysis, null, 2)
          : activeContent.value.content;

      const filled = buildDesignBriefPrompt({
        template: simpleBriefPromptRaw,
        contentSummary: summaryText,
        style: activeStyle,
        profile: activeProfile,
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

      // Шаг B: склейка с автоматическими кусками шага 3 рабочего места
      const layer1 = mode === "strict" ? designProfileColorsAndRules(activeProfile) : "";
      const finalPrompt = [layer1, briefRes.PromptForImageGeneration, executionRulesText]
        .filter((s) => s && s.trim().length > 0)
        .join("\n\n");

      // Шаг C: генерация картинки
      setImageStage("render");
      const dataUrl = await callImageLLM({ model: models.image, prompt: finalPrompt });
      setSimpleCurrent({ dataUrl, prompt: finalPrompt });
      toast.success("Готово");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось сгенерировать изображение");
    } finally {
      setLoading(null);
      setImageStage(null);
    }
  }

  function onConfirmReset() {
    clearSimpleImages();
    resetProject();
    setResetOpen(false);
    setPreviewVersion(null);
    toast.success("Проект сброшен");
  }

  const previewedVersion = previewVersion
    ? simpleVersions.find((v) => v.id === previewVersion) ?? null
    : null;

  const summarySections = useMemo(() => {
    const a = activeContent?.value.analysis;
    return a ? renderSimpleSummary(a) : null;
  }, [activeContent]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Infographic Generator</h1>
          <p className="text-sm text-muted-foreground">Два шага — от темы до готовой инфографики.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
          <RotateCcw className="size-3.5 mr-1" /> Начать заново
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ============ LEFT: CONTROLS ============ */}
        <div className="space-y-4">
          {/* STEP 1 */}
          <section className="rounded-lg border border-border bg-card p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Шаг 1. Исходные данные</h2>
              {activeContent && (
                <Button size="sm" variant="outline" onClick={onAnalyze} disabled={loading !== null}>
                  {loading === "analyze" ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <RefreshCw className="size-3.5 mr-1" />}
                  Перегенерировать
                </Button>
              )}
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12">
                <Label className="text-xs">Тема</Label>
                <Input value={source.topic || ""} onChange={(e) => setSource({ topic: e.target.value })} placeholder="Что изучаем?" />
              </div>
              <div className="col-span-6">
                <Label className="text-xs">Предмет</Label>
                <Select value={source.subject || ""} onValueChange={(v) => setSource({ subject: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите предмет" /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6">
                <Label className="text-xs">Класс</Label>
                <Select value={source.grade || ""} onValueChange={(v) => setSource({ grade: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите класс" /></SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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
                  <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading !== null}>
                    <Upload className="size-3.5 mr-1" /> Файл
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => imageInputRef.current?.click()} disabled={loading !== null}>
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
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".txt,.md,image/*" multiple className="hidden"
                onChange={(e) => { void onFileChosen(e.target.files); e.target.value = ""; }} />
              <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { void onFileChosen(e.target.files); e.target.value = ""; }} />
            </div>

            {!activeContent && (
              <Button onClick={onAnalyze} disabled={loading !== null} className="w-full">
                {loading === "analyze" ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
                Сформировать контент
              </Button>
            )}
          </section>

          {/* STEP 2 */}
          {activeContent && (
            <section className="rounded-lg border border-border bg-card p-5 space-y-5">
              <h2 className="text-lg font-semibold">Шаг 2. Генерация изображения</h2>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12">
                  <Label className="text-xs">Стиль инфографики</Label>
                  <Select value={selectedStyleId ?? activeContent.value.recommendedStyle ?? ""} onValueChange={setSelectedStyleId}>
                    <SelectTrigger><SelectValue placeholder="Выберите стиль" /></SelectTrigger>
                    <SelectContent>
                      {enabledStyles.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-12">
                  <Label className="text-xs">Профиль дизайна</Label>
                  <Select value={selectedProfileName ?? activeProfile?.profileName ?? ""} onValueChange={setSelectedProfileName}>
                    <SelectTrigger><SelectValue placeholder="Выберите профиль" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => <SelectItem key={p.profileName} value={p.profileName}>{p.profileName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Дополнительные требования к изображению</Label>
                <Textarea
                  rows={2}
                  value={userWishes}
                  onChange={(e) => setUserWishes(e.target.value)}
                  placeholder="Например: вынести формулу крупно, добавить иконку треугольника, цитата с автором…"
                />
              </div>

              <Button onClick={onGenerateImage} disabled={loading !== null} className="w-full">
                {loading === "image" ? <Loader2 className="size-4 mr-2 animate-spin" /> : simpleCurrent ? <RefreshCw className="size-4 mr-2" /> : <Sparkles className="size-4 mr-2" />}
                {loading === "image"
                  ? imageStage === "brief" ? "Шаг 1/2: дизайн-бриф…" : "Шаг 2/2: рисуем изображение…"
                  : simpleCurrent ? "Перегенерировать" : "Сгенерировать изображение"}
              </Button>

              {simpleVersions.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Предыдущие версии</div>
                  <div className="flex flex-wrap gap-2">
                    {simpleVersions.map((v, i) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setPreviewVersion(v.id)}
                        className="size-14 rounded border overflow-hidden relative group"
                        title={`ver.${i + 1}`}
                      >
                        <img src={v.dataUrl} alt="" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-white text-center py-0.5">ver.{i + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ============ RIGHT: RESULTS ============ */}
        <div className="space-y-4 lg:sticky lg:top-4">
          {/* Content summary */}
          <section className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h2 className="text-lg font-semibold">Контент</h2>
            <div className="rounded-md border border-border bg-background p-4 min-h-[200px]">
              {loading === "analyze" && !activeContent ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : activeContent ? (
                summarySections ? (
                  <div className="space-y-6">
                    {summarySections.map((sec, si) => (
                      <div key={si} className="space-y-4">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">{sec.sectionLabel}</div>
                        {sec.blocks.map((b, bi) => (
                          <div key={bi} className="space-y-2">
                            {bi > 0 && <hr className="border-border" />}
                            <SimpleBlock block={b} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Markdown>{activeContent.value.content}</Markdown>
                )
              ) : (
                <div className="text-sm text-muted-foreground text-center py-12">
                  Заполните данные слева и нажмите «Сформировать контент»
                </div>
              )}
            </div>
          </section>

          {/* Image result */}
          {activeContent && (
            <section className="rounded-lg border border-border bg-card p-5 space-y-3">
              <h2 className="text-lg font-semibold">Изображение</h2>
              <div className="rounded-md border border-border bg-background min-h-[320px] flex items-center justify-center overflow-hidden">
                {loading === "image" ? (
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                ) : simpleCurrent ? (
                  <img src={simpleCurrent.dataUrl} alt="" className="max-w-full max-h-[80vh]" />
                ) : (
                  <div className="text-sm text-muted-foreground flex flex-col items-center gap-2 py-12">
                    <ImageIcon className="size-8 opacity-50" />
                    Итоговое изображение появится здесь
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

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

      {/* Version preview modal */}
      <AlertDialog open={!!previewedVersion} onOpenChange={(o) => { if (!o) setPreviewVersion(null); }}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Предыдущая версия</AlertDialogTitle>
            <AlertDialogDescription>
              Изображение из предыдущей генерации. Текущее изображение в правой панели не меняется.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {previewedVersion && (
            <img src={previewedVersion.dataUrl} alt="" className="max-w-full rounded border" />
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setPreviewVersion(null)}>Закрыть</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SimpleBlock({ block }: { block: ReturnType<typeof renderSimpleSummary>[number]["blocks"][number] }) {
  return (
    <div className="space-y-2">
      {block.title && <div className="font-semibold text-base">{block.title}</div>}
      {block.content.length > 0 && (
        block.content.length === 1
          ? <div className="text-sm whitespace-pre-wrap">{block.content[0]}</div>
          : <ul className="list-disc pl-5 text-sm space-y-1">{block.content.map((c, i) => <li key={i}>{c}</li>)}</ul>
      )}
      {block.formula.length > 0 && (
        <div className="space-y-1">
          {block.formula.map((f, i) => (
            <div key={i} className="font-mono text-sm bg-muted/40 rounded px-2 py-1">{f}</div>
          ))}
        </div>
      )}
      {block.addendum.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Дополнение</div>
          {block.addendum.map((a, i) => (
            <div key={i} className="text-sm whitespace-pre-wrap">{a}</div>
          ))}
        </div>
      )}
      {block.items && block.items.length > 0 && (
        <div className="pl-3 border-l border-border space-y-3 mt-2">
          {block.items.map((it, i) => <SimpleBlock key={i} block={it} />)}
        </div>
      )}
    </div>
  );
}
