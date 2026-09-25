import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Layers, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlotPreview } from "@/components/plotting/PlotPreview";
import { PlotManualPanel } from "@/components/plotting/PlotManualPanel";
import { PlotAiPanel } from "@/components/plotting/ai/PlotAiPanel";
import { SpaceFaceDepthDebugDialog } from "@/components/plotting/space/SpaceFaceDepthDebugDialog";
import { usePlotStore } from "@/lib/plotting/store";
import { buildSpaceFaceDepthReport } from "@/lib/plotting/space/space-face-depth-report";
import type { SpaceFaceDepthReport } from "@/lib/plotting/space/space-face-depth-report";

export const Route = createFileRoute("/plotting")({
  head: () => ({
    meta: [
      { title: "Plotting — конструктор математических чертежей" },
      {
        name: "description",
        content:
          "Конструктор математических чертежей: числовая прямая, координатная плоскость, экспорт в SVG или PNG.",
      },
      { property: "og:title", content: "Plotting — конструктор математических чертежей" },
      {
        property: "og:description",
        content:
          "Постройте числовую прямую или координатную плоскость, затем выгрузите чертёж в SVG или PNG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlottingPage,
});

function PlottingPage() {
  const inputMode = usePlotStore((state) => state.inputMode);
  const setInputMode = usePlotStore((state) => state.setInputMode);
  const spaceTab = usePlotStore((state) => state.spaceTab);
  const setSpaceTab = usePlotStore((state) => state.setSpaceTab);
  const resetScene = usePlotStore((state) => state.resetScene);
  const scene = usePlotStore((state) => state.scene);
  const space3d = scene.space3d;

  const [aiSessionKey, setAiSessionKey] = useState(0);
  const [faceDepthOpen, setFaceDepthOpen] = useState(false);
  const [faceDepthReport, setFaceDepthReport] = useState<SpaceFaceDepthReport | null>(null);

  const isAi = inputMode === "ai";
  const isLine = spaceTab === "line";
  const isSpace = spaceTab === "space";
  const canFaceDepthDebug = scene.space === "space" && !!space3d?.figure;

  function openFaceDepthDebug() {
    if (!space3d) return;
    setFaceDepthReport(buildSpaceFaceDepthReport(space3d));
    setFaceDepthOpen(true);
  }

  function handleReset() {
    resetScene();
    if (isAi) {
      setAiSessionKey((key) => key + 1);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-4 p-4 lg:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Plotting</h1>
            <p className="text-sm text-muted-foreground">
              {isAi
                ? "ИИ-режим: анализ материала и построение чертежа."
                : isLine
                  ? "Конструктор чертежей на числовой прямой."
                  : isSpace
                    ? "Конструктор пространственных чертежей."
                    : "Конструктор математических чертежей на координатной плоскости."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as "manual" | "ai")}>
              <TabsList>
                <TabsTrigger value="manual">Ручной ввод</TabsTrigger>
                <TabsTrigger value="ai">ИИ-ввод</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canFaceDepthDebug}
              title={
                canFaceDepthDebug
                  ? "Снимок глубин граней многогранника"
                  : "Доступно на вкладке «Пространство» с построенным телом"
              }
              onClick={openFaceDepthDebug}
            >
              <Layers className="size-4" />
              Глубины граней
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="size-4" />
              Сбросить
            </Button>
          </div>
        </header>

        {!isAi && (
          <Tabs value={spaceTab} onValueChange={(value) => setSpaceTab(value as "line" | "plane" | "space")}>
            <TabsList>
              <TabsTrigger value="line">Числовая прямая</TabsTrigger>
              <TabsTrigger value="plane">Координатная плоскость</TabsTrigger>
              <TabsTrigger value="space">Пространство</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
          <div className="min-h-0 space-y-4 overflow-y-auto lg:pr-2">
            {isAi ? <PlotAiPanel key={aiSessionKey} /> : <PlotManualPanel />}
          </div>

          <div className="min-h-0 overflow-y-auto lg:pl-1">
            <PlotPreview />
          </div>
        </div>
      </div>
      <SpaceFaceDepthDebugDialog
        open={faceDepthOpen}
        onOpenChange={setFaceDepthOpen}
        report={faceDepthReport}
      />
    </div>
  );
}
