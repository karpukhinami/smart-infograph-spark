import { createFileRoute } from "@tanstack/react-router";
import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AxesSection } from "@/components/plotting/AxesSection";
import { FunctionCard } from "@/components/plotting/FunctionCard";
import { PointCard } from "@/components/plotting/PointCard";
import { PointDraftPanel } from "@/components/plotting/PointDraftPanel";
import { LineAxisSection } from "@/components/plotting/line/LineAxisSection";
import { SetCard, SetDraftPanel } from "@/components/plotting/line/SetCard";
import { LinePointCard, LinePointDraftPanel } from "@/components/plotting/line/LinePointCard";
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
  const scene = usePlotStore((state) => state.scene);
  const inputMode = usePlotStore((state) => state.inputMode);
  const setInputMode = usePlotStore((state) => state.setInputMode);
  const spaceTab = usePlotStore((state) => state.spaceTab);
  const setSpaceTab = usePlotStore((state) => state.setSpaceTab);
  const addGraph = usePlotStore((state) => state.addGraph);
  const startPointDraft = usePlotStore((state) => state.startPointDraft);
  const pointDraft = usePlotStore((state) => state.pointDraft);
  const setDraft = usePlotStore((state) => state.setDraft);
  const linePointDraft = usePlotStore((state) => state.linePointDraft);
  const startSetDraft = usePlotStore((state) => state.startSetDraft);
  const startLinePointDraft = usePlotStore((state) => state.startLinePointDraft);
  const resetScene = usePlotStore((state) => state.resetScene);

  const isLine = spaceTab === "line";
  const line = scene.line;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-4 p-4 lg:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Plotting</h1>
            <p className="text-sm text-muted-foreground">
              {isLine
                ? "Конструктор чертежей на числовой прямой."
                : "Конструктор математических чертежей на координатной плоскости."}
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
            <TabsTrigger value="line">Числовая прямая</TabsTrigger>
            <TabsTrigger value="plane">Координатная плоскость</TabsTrigger>
            <TabsTrigger value="space" disabled>
              Пространство
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
          <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
            {isLine ? (
              <>
                <LineAxisSection />

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Множества</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!line?.sets.length && !setDraft ? (
                      <p className="text-sm text-muted-foreground">Множества пока не добавлены.</p>
                    ) : (
                      line?.sets.map((set) => <SetCard key={set.id} set={set} />)
                    )}
                    <SetDraftPanel />
                    {!setDraft && (
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => startSetDraft(false)}>
                          <Plus className="size-4" />
                          Множество
                        </Button>
                        <MathSyntaxHint />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Точки</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!line?.points.length && !linePointDraft ? (
                      <p className="text-sm text-muted-foreground">Точки пока не добавлены.</p>
                    ) : (
                      line?.points.map((point) => <LinePointCard key={point.id} point={point} />)
                    )}
                    <LinePointDraftPanel />
                    {!linePointDraft && (
                      <Button type="button" variant="outline" size="sm" onClick={startLinePointDraft}>
                        <Plus className="size-4" />
                        Точка
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <AxesSection />

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Функции</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {scene.graphs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Функции пока не добавлены.</p>
                    ) : (
                      scene.graphs.map((graph) => <FunctionCard key={graph.id} graph={graph} />)
                    )}
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addGraph}>
                        <Plus className="size-4" />
                        Функция
                      </Button>
                      <MathSyntaxHint />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Точки</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {scene.points.length === 0 && !pointDraft ? (
                      <p className="text-sm text-muted-foreground">Точки пока не добавлены.</p>
                    ) : (
                      scene.points.map((point) => <PointCard key={point.id} point={point} />)
                    )}
                    <PointDraftPanel />
                    {!pointDraft && (
                      <Button type="button" variant="outline" size="sm" onClick={startPointDraft}>
                        <Plus className="size-4" />
                        Точка
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="lg:min-h-0 lg:self-start lg:overflow-y-auto">
            <PlotPreview />
          </div>
        </div>
      </div>
    </div>
  );
}
