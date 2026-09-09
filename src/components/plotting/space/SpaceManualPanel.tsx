import { usePlotStore } from "@/lib/plotting/store";
import { SPACE_SHAPE_OPTIONS } from "@/lib/plotting/space/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { SpacePointCard } from "./SpacePointCard";
import { SpaceLineCard } from "./SpaceLineCard";
import { SpacePlaneCard } from "./SpacePlaneCard";
import { SpacePointDraftPanel } from "./SpacePointDraftPanel";
import { SpaceLineDraftPanel } from "./SpaceLineDraftPanel";
import { SpacePlaneDraftPanel } from "./SpacePlaneDraftPanel";
import { Hammer, Plus } from "lucide-react";

export function SpaceManualPanel() {
  const space3d = usePlotStore((s) => s.scene.space3d);
  const setSpaceShapeKind = usePlotStore((s) => s.setSpaceShapeKind);
  const setSpaceBaseInput = usePlotStore((s) => s.setSpaceBaseInput);
  const buildSpaceFigure = usePlotStore((s) => s.buildSpaceFigure);
  const updateSpaceConstraints = usePlotStore((s) => s.updateSpaceConstraints);
  const startSpacePointDraft = usePlotStore((s) => s.startSpacePointDraft);
  const startSpaceLineDraft = usePlotStore((s) => s.startSpaceLineDraft);
  const startSpacePlaneDraft = usePlotStore((s) => s.startSpacePlaneDraft);
  const spacePointDraft = usePlotStore((s) => s.spacePointDraft);
  const spaceLineDraft = usePlotStore((s) => s.spaceLineDraft);
  const spacePlaneDraft = usePlotStore((s) => s.spacePlaneDraft);

  if (!space3d) return null;

  const hasFigure = !!space3d.figure;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Фигура</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Фигура</Label>
            <Select
              value={space3d.shapeKind ?? ""}
              onValueChange={(value) => setSpaceShapeKind(value as "parallelepiped")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите фигуру" />
              </SelectTrigger>
              <SelectContent>
                {SPACE_SHAPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} disabled={!opt.enabled}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {space3d.shapeKind === "parallelepiped" && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Вершины нижнего основания</Label>
                <Input
                  value={space3d.baseVerticesInput}
                  placeholder="A, B, C, D"
                  onChange={(e) => setSpaceBaseInput(e.target.value)}
                />
              </div>
              <div className="space-y-2 rounded-md border border-border p-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Прямоугольный</Label>
                  <Switch
                    checked={space3d.figureConstraints.rectangular}
                    onCheckedChange={(checked) => updateSpaceConstraints({ rectangular: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Равносторонний</Label>
                  <Switch
                    checked={space3d.figureConstraints.equilateral}
                    onCheckedChange={(checked) => updateSpaceConstraints({ equilateral: checked })}
                  />
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">∠BAD</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {space3d.figureConstraints.rectangular
                        ? 90
                        : Math.round(space3d.figureConstraints.badAngleDeg ?? 45)}
                      °
                    </span>
                  </div>
                  <Slider
                    min={10}
                    max={60}
                    step={1}
                    disabled={space3d.figureConstraints.rectangular}
                    value={[
                      space3d.figureConstraints.rectangular
                        ? 90
                        : (space3d.figureConstraints.badAngleDeg ?? 45),
                    ]}
                    onValueChange={([value]) => {
                      if (value === undefined) return;
                      updateSpaceConstraints({ badAngleDeg: value, rectangular: false });
                    }}
                  />
                  {space3d.figureConstraints.rectangular && (
                    <p className="text-[11px] text-muted-foreground">
                      Снимите «Прямоугольный», чтобы менять угол ∠BAD на чертеже.
                    </p>
                  )}
                </div>
              </div>
              <Button type="button" size="sm" className="w-full" onClick={buildSpaceFigure}>
                <Hammer className="size-4" />
                {hasFigure ? "Построить заново" : "Построить"}
              </Button>
              {hasFigure && space3d.figure && (
                <p className="text-xs text-muted-foreground">
                  Основание: {space3d.figure.baseLabels.join(", ")}
                  {space3d.figureDirty ? " · параметры изменены" : ""}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {hasFigure && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Точки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {space3d.points.length === 0 ? (
                <p className="text-sm text-muted-foreground">Дополнительные точки пока не добавлены.</p>
              ) : (
                space3d.points.map((point) => <SpacePointCard key={point.id} point={point} />)
              )}
              {spacePointDraft ? (
                <SpacePointDraftPanel />
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => startSpacePointDraft()}>
                  <Plus className="size-4" />
                  Точка
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Прямые</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {space3d.lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Прямые пока не добавлены.</p>
              ) : (
                space3d.lines.map((line) => <SpaceLineCard key={line.id} line={line} />)
              )}
              {spaceLineDraft ? (
                <SpaceLineDraftPanel />
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => startSpaceLineDraft()}>
                  <Plus className="size-4" />
                  Прямая
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Плоскости</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {space3d.planes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Плоскости пока не добавлены.</p>
              ) : (
                space3d.planes.map((plane) => <SpacePlaneCard key={plane.id} plane={plane} />)
              )}
              {spacePlaneDraft ? (
                <SpacePlaneDraftPanel />
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => startSpacePlaneDraft()}>
                  <Plus className="size-4" />
                  Плоскость
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
