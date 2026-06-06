import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { useProjectStore, useActiveContent, useActiveBrief, useActiveImage } from "@/store/useProjectStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { ModelPicker } from "@/components/workspace/ModelPicker";
import { PromptDisclosure } from "@/components/workspace/PromptDisclosure";
import { Markdown } from "@/components/workspace/Markdown";
import { WireframeView } from "@/components/workspace/WireframeView";
import { callTextLLM, callImageLLM } from "@/lib/llm-client";
import { HelpFiles } from "@/components/workspace/HelpFiles";
import { extractJson } from "@/lib/json-repair";
import type { ContentSummary, DesignBriefResult, PaneMode } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Workspace — AI Infographic Generator" }] }),
  component: Workspace,
});

const SUBJECTS = ["Математика", "Русский язык", "Литература", "Физика", "Химия", "Биология", "География", "История", "Обществознание", "Информатика", "Английский язык", "Другое"];
const GRADES = Array.from({ length: 11 }, (_, i) => String(i + 1));

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

  const activeContent = useActiveContent();
  const activeBrief = useActiveBrief();
  const activeImage = useActiveImage();

  const prompts = useSettingsStore((s) => s.prompts);
  const setPrompt = useSettingsStore((s) => s.setPrompt);
  const styles = useSettingsStore((s) => s.styles);
  const profiles = useSettingsStore((s) => s.profiles);
  const styleGuidelines = useSettingsStore((s) => s.styleGuidelines);

  const [paneMode, setPaneMode] = useState<PaneMode>("content");
  const [loading, setLoading] = useState<null | "analyze" | "brief" | "image">(null);

  const enabledStyles = useMemo(() => styles.filter((s) => s.enabled), [styles]);
  const activeStyle = useMemo(
    () => styles.find((s) => s.id === (selectedStyleId ?? activeContent?.value.recommendedStyle)),
    [styles, selectedStyleId, activeContent],
  );
  const activeProfile = useMemo(
    () => profiles.find((p) => p.profileName === selectedProfileName) ?? profiles[0],
    [profiles, selectedProfileName],
  );

  async function onAnalyze() {
    try {
      setLoading("analyze");
      const stylesList = enabledStyles.map((s) => `- ${s.id}: ${s.name} — ${s.shortDescription}`).join("\n");
      const isTopic = source.mode === "topic";
      const template = isTopic ? prompts.analysisTopicOnly : prompts.analysisWithContent;
      const filled = template
        .replace("{{USER_INSTRUCTIONS}}", source.userInstructions || "(none)")
        .replace("{{STYLES_LIST}}", stylesList || "(no styles available)")
        .replace("{{SOURCE_TEXT}}", source.text || "")
        .replace("{{TOPIC}}", source.topic || "")
        .replace("{{SUBJECT}}", source.subject || "")
        .replace("{{GRADE}}", source.grade || "");
      const raw = await callTextLLM({ model: models.analysis, prompt: filled });
      const parsed = extractJson<ContentSummary>(raw);
      if (!parsed.content || !parsed.recommendedStyle) throw new Error("Model response missing fields");
      pushContent(parsed);
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
      const filled = prompts.designBrief
        .replace("{{CONTENT_SUMMARY}}", activeContent.value.content)
        .replace("{{STYLE_GUIDELINES}}", styleGuidelines || "(none)")
        .replace("{{USER_WISHES}}", userWishes || "(none)")
        .replace("{{STYLE_SPEC}}", JSON.stringify(activeStyle, null, 2))
        .replace("{{DESIGN_PROFILE}}", JSON.stringify(activeProfile ?? {}, null, 2));
      const raw = await callTextLLM({ model: models.brief, prompt: filled });
      const parsed = extractJson<DesignBriefResult>(raw);
      if (!parsed.PromptForImageGeneration || !parsed.WireframeDescription) {
        throw new Error("В ответе модели не хватает полей");
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

  async function onGenerateImage() {
    if (!activeBrief) return;
    try {
      setLoading("image");
      const prompt = userWishes.trim()
        ? `${userWishes.trim()}\n\n${activeBrief.value.PromptForImageGeneration}`
        : activeBrief.value.PromptForImageGeneration;
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

  async function onFileUpload(file: File) {
    const text = await file.text();
    setSource({ mode: "file", text });
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
          <Tabs value={source.mode} onValueChange={(v) => setSource({ mode: v as "text" | "file" | "topic" })}>
            <TabsList>
              <TabsTrigger value="text">Вставить текст</TabsTrigger>
              <TabsTrigger value="file">Загрузить файл</TabsTrigger>
              <TabsTrigger value="topic">Только тема</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="space-y-2">
              <Textarea
                placeholder="Вставьте исходный текст…"
                rows={8}
                value={source.text}
                onChange={(e) => setSource({ text: e.target.value })}
              />
            </TabsContent>
            <TabsContent value="file" className="space-y-2">
              <Input
                type="file"
                accept=".txt,.md"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFileUpload(f); }}
              />
              {source.text && source.mode === "file" && (
                <Textarea rows={6} value={source.text} onChange={(e) => setSource({ text: e.target.value })} />
              )}
            </TabsContent>
            <TabsContent value="topic" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Тема</Label>
                  <Input
                    placeholder="например, Клеточное строение растений"
                    value={source.topic ?? ""}
                    onChange={(e) => setSource({ topic: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Предмет</Label>
                  <Select value={source.subject || ""} onValueChange={(v) => setSource({ subject: v })}>
                    <SelectTrigger><SelectValue placeholder="Предмет" /></SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Класс</Label>
                  <Select value={source.grade || ""} onValueChange={(v) => setSource({ grade: v })}>
                    <SelectTrigger><SelectValue placeholder="Класс" /></SelectTrigger>
                    <SelectContent>
                      {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div>
            <Label className="text-xs">Дополнительные инструкции</Label>
            <Textarea
              rows={3}
              value={source.userInstructions}
              onChange={(e) => setSource({ userInstructions: e.target.value })}
              placeholder="На что сделать акцент, что пропустить, особенности аудитории…"
            />
          </div>

          <PromptDisclosure
            label="Показать промпт анализа"
            value={source.mode === "topic" ? prompts.analysisTopicOnly : prompts.analysisWithContent}
            onChange={(v) =>
              setPrompt(source.mode === "topic" ? "analysisTopicOnly" : "analysisWithContent", v)
            }
            rightSlot={<ModelPicker kind="text" value={models.analysis} onChange={(v) => setModel("analysis", v)} />}
          />

          <div className="flex justify-start">
            <Button onClick={onAnalyze} disabled={loading !== null}>
              {loading === "analyze" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Анализировать
            </Button>
          </div>
        </div>

        {/* STAGE 2 controls */}
        {activeContent && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">2 · Style &amp; Design</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Infographic style</Label>
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
                <Label className="text-xs">Design profile (colors &amp; fonts)</Label>
                <Select
                  value={selectedProfileName ?? activeProfile?.profileName ?? ""}
                  onValueChange={setSelectedProfileName}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => <SelectItem key={p.profileName} value={p.profileName}>{p.profileName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <PromptDisclosure
              label="Show design-brief prompt"
              value={prompts.designBrief}
              onChange={(v) => setPrompt("designBrief", v)}
              rightSlot={<ModelPicker kind="text" value={models.brief} onChange={(v) => setModel("brief", v)} />}
            />
            <div>
              <Button onClick={onCreateBrief} disabled={loading !== null}>
                {loading === "brief" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Create design brief
              </Button>
            </div>
          </div>
        )}

        {/* STAGE 3 controls */}
        {activeBrief && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">3 · Image generation</h2>
            <div>
              <Label className="text-xs">Additional wishes (priority on regeneration)</Label>
              <Textarea
                rows={3}
                value={userWishes}
                onChange={(e) => setUserWishes(e.target.value)}
                placeholder="Anything you'd like to bias the next generation toward..."
              />
            </div>
            <PromptDisclosure
              label="View image prompt"
              value={activeBrief.value.PromptForImageGeneration}
              onChange={(v) => updateActiveBriefPrompt(v)}
              rightSlot={<ModelPicker kind="image" value={models.image} onChange={(v) => setModel("image", v)} />}
            />
            <div>
              <Button onClick={onGenerateImage} disabled={loading !== null}>
                {loading === "image" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Generate image
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
              <TabsTrigger value="content" disabled={!activeContent}>Content</TabsTrigger>
              <TabsTrigger value="wireframe" disabled={!activeBrief}>Wireframe</TabsTrigger>
              <TabsTrigger value="image" disabled={!activeImage}>Final image</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="p-2 space-y-2">
              {activeContent ? (
                <>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={onAnalyze} disabled={loading !== null}>
                      <RefreshCw className="size-3.5 mr-1" /> Regenerate
                    </Button>
                  </div>
                  <Textarea
                    rows={12}
                    value={activeContent.value.content}
                    onChange={(e) => updateActiveContent(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <div className="rounded-md border border-border p-3 bg-background">
                    <Markdown>{activeContent.value.content}</Markdown>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended style: <code>{activeContent.value.recommendedStyle}</code>
                  </p>
                </>
              ) : (
                <EmptyState text="Run analysis to see the content summary here." />
              )}
            </TabsContent>

            <TabsContent value="wireframe" className="p-2 space-y-2">
              {activeBrief ? (
                <>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={onCreateBrief} disabled={loading !== null}>
                      <RefreshCw className="size-3.5 mr-1" /> Regenerate
                    </Button>
                  </div>
                  <WireframeView wf={activeBrief.value.WireframeDescription} />
                </>
              ) : (
                <EmptyState text="Create a design brief to see the wireframe." />
              )}
            </TabsContent>

            <TabsContent value="image" className="p-2 space-y-2">
              {activeImage ? (
                <>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={onGenerateImage} disabled={loading !== null}>
                      <RefreshCw className="size-3.5 mr-1" /> Regenerate
                    </Button>
                  </div>
                  <img src={activeImage.value} alt="Generated infographic" className="w-full rounded-md border border-border" />
                </>
              ) : (
                <EmptyState text="Generate the final image to see it here." />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-10 text-center text-sm text-muted-foreground">{text}</div>
  );
}
