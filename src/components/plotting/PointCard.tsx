import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorSwatches } from "./ColorSwatches";
import { usePlotStore } from "@/lib/plotting/store";
import { graphSummary } from "@/lib/plotting/scene";
import type { PointMode, ScenePoint } from "@/lib/plotting/types";

const MODES: Array<{ value: PointMode; label: string }> = [
  { value: "plane", label: "на плоскости" },
  { value: "onGraph", label: "на графике" },
  { value: "intersection", label: "на пересечении" },
];

export function PointCard({ point }: { point: ScenePoint }) {
  const [open, setOpen] = useState(true);
  const scene = usePlotStore((state) => state.scene);
  const updatePointMath = usePlotStore((state) => state.updatePointMath);
  const updatePointStyle = usePlotStore((state) => state.updatePointStyle);
  const togglePointSolution = usePlotStore((state) => state.togglePointSolution);
  const removePoint = usePlotStore((state) => state.removePoint);
  const buildPoint = usePlotStore((state) => state.buildPoint);
  const addCustomColor = usePlotStore((state) => state.addCustomColor);

  const xName = scene.xAxis.name.trim() || "x";
  const yName = scene.yAxis.name.trim() || "y";
  const math = point.math;
  const selectedGraph = scene.graphs.find((graph) => graph.id === math.graphId);
  const anchorOptions =
    selectedGraph && selectedGraph.math.kind === "qualitative" ? selectedGraph.math.anchors : [];

  const summary = point.built?.length
    ? point.built
        .filter((solution) => solution.show)
        .map((solution) => `(${solution.displayX}; ${solution.displayY})`)
        .join(", ")
    : MODES.find((mode) => mode.value === math.mode)?.label;

  return (
    <Card className="border-border">
      <CardContent className="space-y-3 p-3">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium">
              <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
              <span className="truncate">
                Точка {point.index}
                {summary ? ` — ${summary}` : ""}
              </span>
            </CollapsibleTrigger>
            <span
              className="size-4 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: point.style.color }}
            />
            {point.dirty && point.built && <Badge variant="secondary">есть изменения</Badge>}
            {!point.built && <Badge variant="outline">не построена</Badge>}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={() => removePoint(point.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <CollapsibleContent className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Способ определения</Label>
              <Select
                value={math.mode}
                onValueChange={(value) => updatePointMath(point.id, { mode: value as PointMode })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {math.mode === "plane" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{xName}</Label>
                  <Input
                    value={math.x}
                    placeholder="например pi/2"
                    className="font-mono text-xs"
                    onChange={(event) => updatePointMath(point.id, { x: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{yName}</Label>
                  <Input
                    value={math.y}
                    placeholder="например sqrt(2)"
                    className="font-mono text-xs"
                    onChange={(event) => updatePointMath(point.id, { y: event.target.value })}
                  />
                </div>
              </div>
            )}

            {math.mode === "onGraph" && (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">График</Label>
                  <Select
                    value={math.graphId ?? ""}
                    onValueChange={(value) => updatePointMath(point.id, { graphId: value })}
                  >
                    <SelectTrigger><SelectValue placeholder="выберите график" /></SelectTrigger>
                    <SelectContent>
                      {scene.graphs.map((graph) => (
                        <SelectItem key={graph.id} value={graph.id}>
                          Функция {graph.index} — {graphSummary(graph, yName)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {anchorOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Опорная точка (необязательно)</Label>
                    <Select
                      value={math.anchorIndex === null ? "manual" : String(math.anchorIndex)}
                      onValueChange={(value) =>
                        updatePointMath(point.id, {
                          anchorIndex: value === "manual" ? null : Number(value),
                        })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">ввести координату вручную</SelectItem>
                        {anchorOptions.map((anchor, index) => (
                          <SelectItem key={index} value={String(index)}>
                            {`опорная точка ${index + 1}: (${anchor.x || "—"}; ${anchor.y || "—"})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {math.anchorIndex === null && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{xName}</Label>
                    <Input
                      value={math.x}
                      className="font-mono text-xs"
                      onChange={(event) => updatePointMath(point.id, { x: event.target.value })}
                    />
                  </div>
                )}
              </div>
            )}

            {math.mode === "intersection" && (
              <div className="grid grid-cols-2 gap-2">
                {(["graphId", "graphIdB"] as const).map((key, index) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {index === 0 ? "Первый график" : "Второй график"}
                    </Label>
                    <Select
                      value={math[key] ?? ""}
                      onValueChange={(value) => updatePointMath(point.id, { [key]: value })}
                    >
                      <SelectTrigger><SelectValue placeholder="выберите" /></SelectTrigger>
                      <SelectContent>
                        {scene.graphs.map((graph) => (
                          <SelectItem key={graph.id} value={graph.id}>
                            Функция {graph.index}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            {point.built && point.built.length > 1 && (
              <div className="space-y-1.5 rounded-md border border-border p-2">
                <Label className="text-xs text-muted-foreground">Найденные точки</Label>
                {point.built.map((solution, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs">
                      ({solution.displayX}; {solution.displayY})
                    </span>
                    <Switch
                      checked={solution.show}
                      onCheckedChange={(checked) => togglePointSolution(point.id, index, checked)}
                    />
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                <Label className="text-xs">Выколотая</Label>
                <Switch
                  checked={point.style.open}
                  onCheckedChange={(checked) => updatePointStyle(point.id, { open: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                <Label className="text-xs">Показывать точку</Label>
                <Switch
                  checked={point.style.visible}
                  onCheckedChange={(checked) => updatePointStyle(point.id, { visible: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                <Label className="text-xs">Показать координаты</Label>
                <Switch
                  checked={point.style.showCoords}
                  onCheckedChange={(checked) => updatePointStyle(point.id, { showCoords: checked })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Подпись</Label>
                <Input
                  value={point.style.label}
                  placeholder="например A"
                  className="h-8 text-xs"
                  onChange={(event) => updatePointStyle(point.id, { label: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border p-2">
              <Label className="text-xs text-muted-foreground">Проекции на оси</Label>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Перпендикуляр к горизонтальной оси</Label>
                <Switch
                  checked={point.style.projectX}
                  onCheckedChange={(checked) => updatePointStyle(point.id, { projectX: checked })}
                />
              </div>
              {point.style.projectX && (
                <div className="flex items-center justify-between pl-3">
                  <Label className="text-xs text-muted-foreground">подписать основание</Label>
                  <Switch
                    checked={point.style.labelProjectionX}
                    onCheckedChange={(checked) => updatePointStyle(point.id, { labelProjectionX: checked })}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Перпендикуляр к вертикальной оси</Label>
                <Switch
                  checked={point.style.projectY}
                  onCheckedChange={(checked) => updatePointStyle(point.id, { projectY: checked })}
                />
              </div>
              {point.style.projectY && (
                <div className="flex items-center justify-between pl-3">
                  <Label className="text-xs text-muted-foreground">подписать основание</Label>
                  <Switch
                    checked={point.style.labelProjectionY}
                    onCheckedChange={(checked) => updatePointStyle(point.id, { labelProjectionY: checked })}
                  />
                </div>
              )}
            </div>

            <ColorSwatches
              value={point.style.color}
              onChange={(color) => updatePointStyle(point.id, { color })}
              customColors={scene.customColors}
              onAddCustomColor={addCustomColor}
              label="Цвет точки"
            />

            {point.error && <p className="text-xs text-destructive">{point.error}</p>}

            <Button type="button" size="sm" className="w-full" onClick={() => buildPoint(point.id)}>
              Построить
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
