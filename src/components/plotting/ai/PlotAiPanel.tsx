import { useState } from "react";
import { Loader2, Sparkles, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ModelPicker } from "@/components/workspace/ModelPicker";
import { Markdown } from "@/components/workspace/Markdown";
import { DEFAULT_TEXT_MODEL } from "@/lib/models";
import { hasSourceMaterials } from "@/lib/source-material";
import { analyzePlotMaterial, generatePlotScene } from "@/lib/plotting/ai/pipeline";
import type { PlotAiScenario, PlotAnalysisResult } from "@/lib/plotting/ai/types";
import { usePlotStore } from "@/lib/plotting/store";
import {
  PlotSourceInput,
  importPlotSourceFiles,
  usePlotSourceState,
} from "./PlotSourceInput";
import { PlotManualPanel } from "../PlotManualPanel";
import { cn } from "@/lib/utils";

const SCENARIOS: Array<{ id: PlotAiScenario; label: string }> = [
  { id: "draw", label: "Нарисовать по заданию" },
  { id: "reproduce", label: "Воспроизвести изображение" },
  { id: "analog", label: "Создать аналогичное задание с изображением" },
];

export function PlotAiPanel() {
  const importAiScene = usePlotStore((s) => s.importAiScene);

  const source = usePlotSourceState();
  const [model, setModel] = useState(DEFAULT_TEXT_MODEL);
  const [scenario, setScenario] = useState<PlotAiScenario>("draw");
  const [analysis, setAnalysis] = useState<PlotAnalysisResult | null>(null);
  const [userRefinements, setUserRefinements] = useState("");
  const [analogTaskText, setAnalogTaskText] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [sceneBuilt, setSceneBuilt] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { manualText, attachedImages, documents } = source;
  const hasSource = hasSourceMaterials(manualText, source.state.uploadedSourceText, attachedImages);

  async function handleAttachFiles(files: File[]) {
    await importPlotSourceFiles(files, {
      addDocument: source.addDocument,
      addImages: source.addImages,
    });
  }

  async function handlePasteImages(files: File[]) {
    const dataUrls = await Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );
    source.addImages(dataUrls);
    toast.success("Изображение вставлено из буфера обмена");
  }

  async function onAnalyze() {
    if (!hasSource) {
      toast.error("Добавьте исходный материал: текст, PDF или изображение");
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    setAnalogTaskText(null);
    setSceneBuilt(false);
    setEditOpen(false);
    try {
      const result = await analyzePlotMaterial({
        model,
        scenario,
        manualText,
        uploadedSourceText: source.state.uploadedSourceText,
        attachedImages,
      });
      setAnalysis(result);
      if (!result.canDraw) {
        toast.message("Построение недоступно", {
          description: "Смотрите результат анализа ниже",
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка анализа");
    } finally {
      setAnalyzing(false);
    }
  }

  async function onDraw() {
    if (!analysis?.canDraw || !analysis.sceneType) return;
    setDrawing(true);
    try {
      const result = await generatePlotScene({
        model,
        scenario,
        manualText,
        uploadedSourceText: source.state.uploadedSourceText,
        attachedImages,
        analysis,
        userRefinements,
      });
      importAiScene(result.scene);
      setSceneBuilt(true);
      if ("newTaskText" in result && result.newTaskText) {
        setAnalogTaskText(result.newTaskText);
      }
      toast.success("Чертёж построен");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось построить чертёж");
    } finally {
      setDrawing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Сценарий</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup
            value={scenario}
            onValueChange={(v) => {
              setScenario(v as PlotAiScenario);
              setAnalysis(null);
              setSceneBuilt(false);
            }}
            className="space-y-2"
          >
            {SCENARIOS.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem value={s.id} className="mt-0.5" />
                <span>{s.label}</span>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Модель</CardTitle>
            <ModelPicker kind="text" value={model} onChange={setModel} />
          </div>
        </CardHeader>
        <CardContent>
          <PlotSourceInput
            manualText={manualText}
            onManualTextChange={source.setManualText}
            attachedImages={attachedImages}
            documents={documents}
            onAttachFiles={handleAttachFiles}
            onPasteImages={handlePasteImages}
            onRemoveImage={source.removeImage}
            onRemoveDocument={source.removeDocument}
          />
        </CardContent>
      </Card>

      <Button
        type="button"
        className="w-full"
        disabled={!hasSource || analyzing}
        onClick={() => void onAnalyze()}
      >
        {analyzing ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="size-4 mr-2" />
        )}
        Проанализировать
      </Button>

      {analysis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Результат анализа</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Markdown>{analysis.analysisText}</Markdown>
            {analysis.canDraw && analysis.sceneType && (
              <p className="text-xs text-muted-foreground">
                Тип сцены:{" "}
                {analysis.sceneType === "plane"
                  ? "координатная плоскость"
                  : analysis.sceneType === "space"
                    ? "пространство (многогранник)"
                    : "числовая прямая"}
              </p>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Дополнительные пожелания или изменения</Label>
              <Textarea
                rows={3}
                placeholder="Уточнения перед построением (имеют приоритет над анализом)"
                value={userRefinements}
                onChange={(e) => setUserRefinements(e.target.value)}
              />
            </div>
            {analysis.canDraw && (
              <Button
                type="button"
                className="w-full"
                disabled={drawing}
                onClick={() => void onDraw()}
              >
                {drawing ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Pencil className="size-4 mr-2" />
                )}
                Нарисовать
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {analogTaskText && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Новое задание</CardTitle>
          </CardHeader>
          <CardContent>
            <Markdown>{analogTaskText}</Markdown>
          </CardContent>
        </Card>
      )}

      {sceneBuilt && (
        <Collapsible open={editOpen} onOpenChange={setEditOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between">
              Редактировать изображение
              <span className={cn("text-xs text-muted-foreground", editOpen && "rotate-180")}>▼</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <PlotManualPanel />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
