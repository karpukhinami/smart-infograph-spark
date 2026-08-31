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
import type { PointMode, PointStyle, ScenePoint } from "@/lib/plotting/types";

const MODES: Array<{ value: PointMode; label: string }> = [
  { value: "plane", label: "на плоскости" },
  { value: "onGraph", label: "на графике" },
  { value: "intersection", label: "на пересечении" },
];

/** Полный набор опций оформления точки (общий для точки и отдельных решений). */
function StyleFields({
  style,
  onChange,
  customColors,
  onAddCustomColor,
}: {
  style: PointStyle;
  onChange: (patch: Partial<PointStyle>) => void;
  customColors: string[];
  onAddCustomColor: (color: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
          <Label className="text-xs">Выколотая</Label>
          <Switch checked={style.open} onCheckedChange={(checked) => onChange({ open: checked })} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
          <Label className="text-xs">Показывать точку</Label>
          <Switch
            checked={style.visible}
            onCheckedChange={(checked) => onChange({ visible: checked })}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
          <Label className="text-xs">Показать координаты</Label>
          <Switch
            checked={style.showCoords}
            onCheckedChange={(checked) => onChange({ showCoords: checked })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Подпись</Label>
          <Input
            value={style.label}
            placeholder="например A"
            className="h-8 text-xs"
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-border p-2">
        <Label className="text-xs text-muted-foreground">Проекции на оси</Label>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Перпендикуляр к горизонтальной оси</Label>
          <Switch
            checked={style.projectX}
            onCheckedChange={(checked) => onChange({ projectX: checked })}
          />
        </div>
        {style.projectX && (
          <div className="flex items-center justify-between pl-3">
            <Label className="text-xs text-muted-foreground">подписать основание</Label>
            <Switch
              checked={style.labelProjectionX}
              onCheckedChange={(checked) => onChange({ labelProjectionX: checked })}
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <Label className="text-xs">Перпендикуляр к вертикальной оси</Label>
          <Switch
            checked={style.projectY}
            onCheckedChange={(checked) => onChange({ projectY: checked })}
          />
        </div>
        {style.projectY && (
          <div className="flex items-center justify-between pl-3">
            <Label className="text-xs text-muted-foreground">подписать основание</Label>
            <Switch
              checked={style.labelProjectionY}
              onCheckedChange={(checked) => onChange({ labelProjectionY: checked })}
            />
          </div>
        )}
      </div>

      <ColorSwatches
        value={style.color}
        onChange={(color) => onChange({ color })}
        customColors={customColors}
        onAddCustomColor={onAddCustomColor}
        label="Цвет точки"
      />
    </div>
  );
}

export function PointCard({ point }: { point: ScenePoint }) {
  const [open, setOpen] = useState(true);
  const [openSolution, setOpenSolution] = useState<number | null>(null);
  const scene = usePlotStore((state) => state.scene);
  const updatePointMath = usePlotStore((state) => state.updatePointMath);
  const updatePointStyle = usePlotStore((state) => state.updatePointStyle);
  const updateSolutionStyle = usePlotStore((state) => state.updateSolutionStyle);
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
  const solutions = point.built ?? [];
  const multi = solutions.length > 1;

  const summary = solutions.length
    ? solutions
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
              <div className="space-y-2">
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => buildPoint(point.id)}
                >
                  Рассчитать пересечения
                </Button>
                <p className="text-xs text-muted-foreground">
                  После расчёта каждую найденную точку можно настроить отдельно.
                </p>
              </div>
            )}

            {multi && (
              <div className="space-y-2 rounded-md border border-border p-2">
                <Label className="text-xs text-muted-foreground">
                  Найденные точки: {solutions.length}
                </Label>
                {solutions.map((solution, index) => {
                  const merged = { ...point.style, ...(solution.style ?? {}) } as PointStyle;
                  const expanded = openSolution === index;
                  return (
                    <div key={index} className="rounded-md border border-border">
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => setOpenSolution(expanded ? null : index)}
                        >
                          <ChevronDown
                            className={`size-3.5 shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`}
                          />
                          <span className="truncate font-mono text-xs">
                            ({solution.displayX}; {solution.displayY})
                          </span>
                        </button>
                        <span
                          className="size-3.5 shrink-0 rounded-full border border-border"
                          style={{ backgroundColor: merged.color }}
                        />
                        <Switch
                          checked={solution.show}
                          onCheckedChange={(checked) => togglePointSolution(point.id, index, checked)}
                        />
                      </div>
                      {expanded && (
                        <div className="border-t border-border p-2">
                          <StyleFields
                            style={merged}
                            onChange={(patch) => updateSolutionStyle(point.id, index, patch)}
                            customColors={scene.customColors}
                            onAddCustomColor={addCustomColor}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <Separator />

            {multi && (
              <Label className="text-xs text-muted-foreground">
                Общие настройки (применяются ко всем найденным точкам)
              </Label>
            )}
            <StyleFields
              style={point.style}
              onChange={(patch) => updatePointStyle(point.id, patch)}
              customColors={scene.customColors}
              onAddCustomColor={addCustomColor}
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
