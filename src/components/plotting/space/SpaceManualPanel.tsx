import { usePlotStore } from "@/lib/plotting/store";
import { normalizeYawDeg, YAW_SNAP_DEG } from "@/lib/plotting/space/camera";
import {
  SPACE_SHAPE_OPTIONS,
  type ParallelepipedConstraints,
  type PrismConstraints,
  type PyramidConstraints,
  type SpaceFigureConstraints,
} from "@/lib/plotting/space/types";
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

function isParallelepipedConstraints(c: SpaceFigureConstraints): c is ParallelepipedConstraints {
  return "rectangular" in c;
}

function isPyramidConstraints(c: SpaceFigureConstraints): c is PyramidConstraints {
  return "apexOnCenter" in c;
}

function isPrismConstraints(c: SpaceFigureConstraints): c is PrismConstraints {
  return "straight" in c;
}

export function SpaceManualPanel() {
  const space3d = usePlotStore((s) => s.scene.space3d);
  const setSpaceShapeKind = usePlotStore((s) => s.setSpaceShapeKind);
  const setSpaceBaseInput = usePlotStore((s) => s.setSpaceBaseInput);
  const buildSpaceFigure = usePlotStore((s) => s.buildSpaceFigure);
  const updateSpaceConstraints = usePlotStore((s) => s.updateSpaceConstraints);
  const updateSpaceView = usePlotStore((s) => s.updateSpaceView);
  const startSpacePointDraft = usePlotStore((s) => s.startSpacePointDraft);
  const startSpaceLineDraft = usePlotStore((s) => s.startSpaceLineDraft);
  const startSpacePlaneDraft = usePlotStore((s) => s.startSpacePlaneDraft);
  const spacePointDraft = usePlotStore((s) => s.spacePointDraft);
  const spaceLineDraft = usePlotStore((s) => s.spaceLineDraft);
  const spacePlaneDraft = usePlotStore((s) => s.spacePlaneDraft);

  if (!space3d) return null;

  const hasFigure = !!space3d.figure;
  const isPyramid = space3d.shapeKind === "pyramid" || space3d.figure?.kind === "pyramid";
  const isPrismShape = space3d.shapeKind === "prism" || space3d.figure?.kind === "prism";
  const isSchoolExtrusion = isPyramid || isPrismShape;
  const ppConstraints = isParallelepipedConstraints(space3d.figureConstraints)
    ? space3d.figureConstraints
    : null;
  const pyrConstraints = isPyramidConstraints(space3d.figureConstraints)
    ? space3d.figureConstraints
    : null;
  const prismConstraints = isPrismConstraints(space3d.figureConstraints)
    ? space3d.figureConstraints
    : null;

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
              onValueChange={(value) =>
                setSpaceShapeKind(value as "parallelepiped" | "pyramid" | "prism")
              }
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

          {(space3d.shapeKind === "parallelepiped" ||
            space3d.shapeKind === "pyramid" ||
            space3d.shapeKind === "prism") && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {space3d.shapeKind === "pyramid"
                    ? "Вершина и основание"
                    : "Вершины нижнего основания"}
                </Label>
                <Input
                  value={space3d.baseVerticesInput}
                  placeholder={
                    space3d.shapeKind === "pyramid"
                      ? "S, A, B, C"
                      : space3d.shapeKind === "prism"
                        ? "A, B, C, D"
                        : "A, B, C, D"
                  }
                  onChange={(e) => setSpaceBaseInput(e.target.value)}
                />
                {space3d.shapeKind === "pyramid" && (
                  <p className="text-[11px] text-muted-foreground">
                    Первая буква — вершина пирамиды, остальные — вершины основания по порядку (минимум 3).
                  </p>
                )}
                {space3d.shapeKind === "prism" && (
                  <p className="text-[11px] text-muted-foreground">
                    Буквы нижнего основания по порядку (минимум 3). Верхнее основание — те же буквы с индексом 1.
                  </p>
                )}
              </div>
              <div className="space-y-2 rounded-md border border-border p-2">
                {space3d.shapeKind === "parallelepiped" && ppConstraints && (
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Прямоугольный</Label>
                    <Switch
                      checked={ppConstraints.rectangular}
                      onCheckedChange={(checked) => updateSpaceConstraints({ rectangular: checked })}
                    />
                  </div>
                )}
                {space3d.shapeKind === "pyramid" && pyrConstraints && (
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Вершина над центром основания</Label>
                    <Switch
                      checked={pyrConstraints.apexOnCenter}
                      onCheckedChange={(checked) => updateSpaceConstraints({ apexOnCenter: checked })}
                    />
                  </div>
                )}
                {space3d.shapeKind === "prism" && prismConstraints && (
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Прямая</Label>
                    <Switch
                      checked={prismConstraints.straight}
                      onCheckedChange={(checked) => updateSpaceConstraints({ straight: checked })}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Равносторонний</Label>
                  <Switch
                    checked={space3d.figureConstraints.equilateral}
                    onCheckedChange={(checked) => updateSpaceConstraints({ equilateral: checked })}
                  />
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      {space3d.shapeKind === "pyramid" || space3d.shapeKind === "prism"
                        ? "∠ первого ребра основания"
                        : "∠BAD"}
                    </Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {Math.round(space3d.figureConstraints.badAngleDeg ?? 35)}°
                    </span>
                  </div>
                  <Slider
                    min={10}
                    max={60}
                    step={1}
                    value={[space3d.figureConstraints.badAngleDeg ?? 35]}
                    onValueChange={([value]) => {
                      if (value === undefined) return;
                      updateSpaceConstraints({ badAngleDeg: value });
                    }}
                  />
                  {space3d.shapeKind === "parallelepiped" && (
                    <p className="text-[11px] text-muted-foreground">
                      «Прямоугольный» задаёт вертикаль AA₁; угол ∠BAD — наклон глубинных рёбер.
                    </p>
                  )}
                  {space3d.shapeKind === "prism" && (
                    <p className="text-[11px] text-muted-foreground">
                      «Прямая» выкл — как вершина пирамиды над центром основания; вкл — как над первой вершиной основания.
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
                  {space3d.figure.kind === "pyramid"
                    ? `Вершина: ${space3d.figure.apexLabel}; основание: ${space3d.figure.baseLabels.join(", ")}`
                    : space3d.figure.kind === "prism"
                      ? `Основание: ${space3d.figure.baseLabels.join(", ")}`
                      : `Основание: ${space3d.figure.baseLabels.join(", ")}`}
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
              <CardTitle className="text-base">Вид</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Поворот</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {Math.round(normalizeYawDeg(space3d.view.yaw))}°
                  </span>
                </div>
                <div className="relative px-1 pt-1">
                  <div
                    className="pointer-events-none absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-full bg-muted-foreground/70"
                    style={{ left: "calc(0% + 4px)" }}
                    title={`Стандартное положение (±${YAW_SNAP_DEG}°)`}
                  />
                  <Slider
                    min={0}
                    max={360}
                    step={1}
                    value={[((space3d.view.yaw % 360) + 360) % 360]}
                    onValueChange={([value]) => {
                      if (value === undefined) return;
                      updateSpaceView({ yaw: normalizeYawDeg(value) });
                    }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isSchoolExtrusion
                    ? "Вращение основания по эллипсу вокруг вертикальной оси; у нуля — стандартный ракурс (липкий ±"
                    : "Вращение вокруг вертикальной оси; ∠BAD задаёт форму эллипса основания. У нуля — стандартный ракурс (липкий ±"}
                  {YAW_SNAP_DEG}°).
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Эллипс вращения</Label>
                <Switch
                  checked={space3d.view.showRotationEllipse ?? false}
                  onCheckedChange={(checked) => updateSpaceView({ showRotationEllipse: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-2">
                <div className="space-y-0.5">
                  <Label className="text-xs">Лучи точки обзора</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {isSchoolExtrusion
                      ? "Отладка: лучи к условной точке обзора чертежа (не часть построения). Глаз: (4,4,1) при yaw=0, при повороте основания — вращение на −ψ вокруг z."
                      : "Отладка: лучи к условной точке обзора чертежа (не часть построения)."}
                  </p>
                </div>
                <Switch
                  checked={space3d.view.showViewConvergenceRays ?? false}
                  onCheckedChange={(checked) => updateSpaceView({ showViewConvergenceRays: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-2">
                <div className="space-y-0.5">
                  <Label className="text-xs">Показывать линии пересечения</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Только визуальный пунктир; новые точки и прямые не создаются.
                  </p>
                </div>
                <Switch
                  checked={space3d.view.showPlaneIntersections ?? false}
                  onCheckedChange={(checked) => updateSpaceView({ showPlaneIntersections: checked })}
                />
              </div>
              {isSchoolExtrusion && (
                <p className="text-[11px] text-muted-foreground">
                  Контур, в который вписано основание; угол «плохого» ребра задаёт наклон, как у
                  параллелепипеда.
                </p>
              )}
            </CardContent>
          </Card>

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
              <div className="flex items-center justify-between rounded-md border border-border p-2">
                <div className="space-y-0.5">
                  <Label className="text-xs">Рассчитать глубину</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Заливка плоскостей по глубине; линия их пересечения показывается пунктиром.
                  </p>
                </div>
                <Switch
                  checked={space3d.view.planeFillByDepth ?? false}
                  onCheckedChange={(checked) => updateSpaceView({ planeFillByDepth: checked })}
                />
              </div>
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
