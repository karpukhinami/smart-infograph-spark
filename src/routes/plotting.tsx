import { createFileRoute } from "@tanstack/react-router";
import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AxesSection } from "@/components/plotting/AxesSection";
import { FunctionCard } from "@/components/plotting/FunctionCard";
import { PointCard } from "@/components/plotting/PointCard";
import { PlotPreview } from "@/components/plotting/PlotPreview";
import { MathSyntaxHint } from "@/components/plotting/MathInput";
import { usePlotStore } from "@/lib/plotting/store";

export const Route = createFileRoute("/plotting")({
  head: () => ({
    meta: [
      { title: "Plotting — конструктор математических чертежей" },
      {
        name: "description",
        content:
          "Конструктор чертежей на координатной плоскости: графики функций, точки, проекции и экспорт в SVG или PNG.",
      },
      { property: "og:title", content: "Plotting — конструктор математических чертежей" },
      {
        property: "og:description",
        content:
          "Постройте координатную плоскость, графики и точки, затем выгрузите чертёж в SVG или PNG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlottingPage,
});

function PlottingPage() {
  const scene = usePlotStore((state) => state.scene);
  const inputMode = usePlotStore((state) => state.inputMode);
  const setInputMode = usePlotStore((state) => state.setInputMode);
  const spaceTab = usePlotStore((state) => state.spaceTab);
  const setSpaceTab = usePlotStore((state) => state.setSpaceTab);
  const addGraph = usePlotStore((state) => state.addGraph);
  const addPoint = usePlotStore((state) => state.addPoint);
  const resetScene = usePlotStore((state) => state.resetScene);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-4 p-4 lg:p-6">

        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Plotting</h1>
            <p className="text-sm text-muted-foreground">
              Конструктор математических чертежей на координатной плоскости.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as "manual" | "ai")}>
              <TabsList>
                <TabsTrigger value="manual">Ручной ввод</TabsTrigger>
                <TabsTrigger value="ai" disabled>
                  ИИ-ввод
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button type="button" variant="outline" size="sm" onClick={resetScene}>
              <RotateCcw className="size-4" />
              Сбросить
            </Button>
          </div>
        </header>

        <Tabs value={spaceTab} onValueChange={(value) => setSpaceTab(value as "line" | "plane" | "space")}>
          <TabsList>
            <TabsTrigger value="line" disabled>
              Числовая прямая
            </TabsTrigger>
            <TabsTrigger value="plane">Координатная плоскость</TabsTrigger>
            <TabsTrigger value="space" disabled>
              Пространство
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
          <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">

            <AxesSection />

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Функции</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addGraph}>
                  <Plus className="size-4" />
                  Функция
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {scene.graphs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Функции пока не добавлены.</p>
                ) : (
                  scene.graphs.map((graph) => <FunctionCard key={graph.id} graph={graph} />)
                )}
                <MathSyntaxHint />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Точки</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addPoint}>
                  <Plus className="size-4" />
                  Точка
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {scene.points.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Точки пока не добавлены.</p>
                ) : (
                  scene.points.map((point) => <PointCard key={point.id} point={point} />)
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:min-h-0 lg:self-start lg:overflow-y-auto">
            <PlotPreview />
          </div>

        </div>
      </div>
    </div>
  );
}
