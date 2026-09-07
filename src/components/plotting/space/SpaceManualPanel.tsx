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
import { SpacePointCard } from "./SpacePointCard";
import { SpaceLineCard } from "./SpaceLineCard";
import { SpacePlaneCard } from "./SpacePlaneCard";
import { Plus } from "lucide-react";

export function SpaceManualPanel() {
  const space3d = usePlotStore((s) => s.scene.space3d);
  const setSpaceShapeKind = usePlotStore((s) => s.setSpaceShapeKind);
  const setSpaceBaseInput = usePlotStore((s) => s.setSpaceBaseInput);
  const createSpaceFigure = usePlotStore((s) => s.createSpaceFigure);
  const updateSpaceConstraints = usePlotStore((s) => s.updateSpaceConstraints);
  const startSpacePointOnLine = usePlotStore((s) => s.startSpacePointOnLine);
  const startSpacePointOnFace = usePlotStore((s) => s.startSpacePointOnFace);
  const addSpaceLine = usePlotStore((s) => s.addSpaceLine);
  const addSpacePlane = usePlotStore((s) => s.addSpacePlane);

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

          {space3d.shapeKind === "parallelepiped" && !hasFigure && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Вершины нижнего основания</Label>
              <Input
                value={space3d.baseVerticesInput}
                placeholder="A, B, C, D"
                onChange={(e) => setSpaceBaseInput(e.target.value)}
              />
              <Button type="button" size="sm" onClick={createSpaceFigure}>
                Создать параллелепипед
              </Button>
            </div>
          )}

          {hasFigure && space3d.figure && (
            <div className="space-y-2 rounded-md border border-border p-2">
              <p className="text-xs text-muted-foreground">
                Основание: {space3d.figure.baseLabels.join(", ")}
              </p>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Прямоугольный</Label>
                <Switch
                  checked={space3d.figure.constraints.rectangular}
                  onCheckedChange={(checked) => updateSpaceConstraints({ rectangular: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Равносторонний</Label>
                <Switch
                  checked={space3d.figure.constraints.equilateral}
                  onCheckedChange={(checked) => updateSpaceConstraints({ equilateral: checked })}
                />
              </div>
            </div>
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
              <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => startSpacePointOnLine()}>
                    <Plus className="size-4" />
                    На прямой
                  </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => startSpacePointOnFace()}>
                  <Plus className="size-4" />
                  На грани
                </Button>
              </div>
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
              <Button type="button" variant="outline" size="sm" onClick={() => addSpaceLine()}>
                <Plus className="size-4" />
                Прямая
              </Button>
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
              <Button type="button" variant="outline" size="sm" onClick={() => addSpacePlane()}>
                <Plus className="size-4" />
                Плоскость
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
