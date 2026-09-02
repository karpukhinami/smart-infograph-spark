/** Ручные инструменты редактирования сцены (переиспользуются в AI-режиме). */
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AxesSection } from "@/components/plotting/AxesSection";
import { FunctionCard } from "@/components/plotting/FunctionCard";
import { PointCard } from "@/components/plotting/PointCard";
import { PointDraftPanel } from "@/components/plotting/PointDraftPanel";
import { LineAxisSection } from "@/components/plotting/line/LineAxisSection";
import { SetCard, SetDraftPanel } from "@/components/plotting/line/SetCard";
import { LinePointCard, LinePointDraftPanel } from "@/components/plotting/line/LinePointCard";
import { MathSyntaxHint } from "@/components/plotting/MathInput";
import { usePlotStore } from "@/lib/plotting/store";

export function PlotManualPanel() {
  const scene = usePlotStore((state) => state.scene);
  const addGraph = usePlotStore((state) => state.addGraph);
  const startPointDraft = usePlotStore((state) => state.startPointDraft);
  const pointDraft = usePlotStore((state) => state.pointDraft);
  const setDraft = usePlotStore((state) => state.setDraft);
  const linePointDraft = usePlotStore((state) => state.linePointDraft);
  const startSetDraft = usePlotStore((state) => state.startSetDraft);
  const startLinePointDraft = usePlotStore((state) => state.startLinePointDraft);
  const setAllLinePerpendiculars = usePlotStore((state) => state.setAllLinePerpendiculars);

  const isLine = scene.space === "line";
  const line = scene.line;

  if (isLine) {
    return (
      <div className="space-y-4">
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
            {(line?.points.length ?? 0) > 0 && (
              <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                <Label className="text-xs">Построить перпендикуляры</Label>
                <Switch
                  checked={line?.points.every((point) => point.style.perpendicular) ?? false}
                  onCheckedChange={setAllLinePerpendiculars}
                />
              </div>
            )}
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
    </div>
  );
}
