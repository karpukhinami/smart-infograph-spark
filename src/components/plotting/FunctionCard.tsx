import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MathInput } from "./MathInput";
import { ColorSwatches } from "./ColorSwatches";
import { usePlotStore } from "@/lib/plotting/store";
import { graphSummary } from "@/lib/plotting/scene";
import type { AnchorKind, GraphKind, SceneGraph } from "@/lib/plotting/types";

const KINDS: Array<{ value: GraphKind; label: string }> = [
  { value: "explicit", label: "явное задание" },
  { value: "implicit", label: "неявное задание" },
  { value: "piecewise", label: "кусочно-аналитическое задание" },
  { value: "qualitative", label: "задание через набор точек" },
];

const ANCHOR_KINDS: Array<{ value: AnchorKind; label: string }> = [
  { value: "plain", label: "обычная" },
  { value: "min", label: "минимум" },
  { value: "max", label: "максимум" },
];

export function FunctionCard({ graph }: { graph: SceneGraph }) {
  const [open, setOpen] = useState(true);
  const scene = usePlotStore((state) => state.scene);
  const updateGraphMath = usePlotStore((state) => state.updateGraphMath);
  const updateGraphStyle = usePlotStore((state) => state.updateGraphStyle);
  const removeGraph = usePlotStore((state) => state.removeGraph);
  const buildGraph = usePlotStore((state) => state.buildGraph);
  const addCustomColor = usePlotStore((state) => state.addCustomColor);

  const xName = scene.xAxis.name.trim() || "x";
  const yName = scene.yAxis.name.trim() || "y";
  const math = graph.math;

  return (
    <Card className="border-border">
      <CardContent className="space-y-3 p-3">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium">
              <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
              <span className="truncate">
                Функция {graph.index} — {graphSummary(graph, yName)}
              </span>
            </CollapsibleTrigger>
            <span
              className="size-4 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: graph.style.color }}
            />
            {graph.dirty && graph.built && <Badge variant="secondary">есть изменения</Badge>}
            {!graph.built && <Badge variant="outline">не построена</Badge>}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={() => removeGraph(graph.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <CollapsibleContent className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Тип задания</Label>
              <Select
                value={math.kind}
                onValueChange={(value) => updateGraphMath(graph.id, { kind: value as GraphKind })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((kind) => (
                    <SelectItem key={kind.value} value={kind.value}>{kind.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {math.kind === "explicit" && (
              <MathInput
                value={math.expression}
                onChange={(value) => updateGraphMath(graph.id, { expression: value })}
                variables={[xName]}
                prefix={`${yName} =`}
                placeholder={`например ${xName}^2 - 4`}
              />
            )}

            {math.kind === "implicit" && (
              <MathInput
                value={math.equation}
                onChange={(value) => updateGraphMath(graph.id, { equation: value })}
                variables={[xName, yName]}
                equation
                placeholder={`например ${xName}^2 + ${yName}^2 = 4`}
              />
            )}

            {math.kind === "piecewise" && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Участки</Label>
                <div className="flex gap-2">
                  <div className="flex shrink-0 items-stretch gap-1">
                    <span className="self-center font-medium italic">{yName} =</span>
                    <span
                      className="w-3 rounded-l-md border-y-2 border-l-2 border-border"
                      aria-hidden
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    {math.pieces.map((piece, index) => (
                      <div key={index} className="space-y-2 rounded-md border border-border p-2">
                        <MathInput
                          value={piece.expression}
                          onChange={(value) =>
                            updateGraphMath(graph.id, {
                              pieces: math.pieces.map((item, position) =>
                                position === index ? { ...item, expression: value } : item,
                              ),
                            })
                          }
                          variables={[xName]}
                          placeholder="формула участка"
                          showHint={false}
                        />
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Input
                            value={piece.from}
                            placeholder="-∞"
                            className="w-20 font-mono text-xs"
                            onChange={(event) =>
                              updateGraphMath(graph.id, {
                                pieces: math.pieces.map((item, position) =>
                                  position === index ? { ...item, from: event.target.value } : item,
                                ),
                              })
                            }
                          />
                          <Select
                            value={piece.includeFrom ? "inclusive" : "strict"}
                            onValueChange={(value) =>
                              updateGraphMath(graph.id, {
                                pieces: math.pieces.map((item, position) =>
                                  position === index ? { ...item, includeFrom: value === "inclusive" } : item,
                                ),
                              })
                            }
                          >
                            <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="strict">&lt;</SelectItem>
                              <SelectItem value="inclusive">≤</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="italic">{xName}</span>
                          <Select
                            value={piece.includeTo ? "inclusive" : "strict"}
                            onValueChange={(value) =>
                              updateGraphMath(graph.id, {
                                pieces: math.pieces.map((item, position) =>
                                  position === index ? { ...item, includeTo: value === "inclusive" } : item,
                                ),
                              })
                            }
                          >
                            <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="strict">&lt;</SelectItem>
                              <SelectItem value="inclusive">≤</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={piece.to}
                            placeholder="+∞"
                            className="w-20 font-mono text-xs"
                            onChange={(event) =>
                              updateGraphMath(graph.id, {
                                pieces: math.pieces.map((item, position) =>
                                  position === index ? { ...item, to: event.target.value } : item,
                                ),
                              })
                            }
                          />
                          {math.pieces.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground"
                              onClick={() =>
                                updateGraphMath(graph.id, {
                                  pieces: math.pieces.filter((_item, position) => position !== index),
                                })
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateGraphMath(graph.id, {
                          pieces: [
                            ...math.pieces,
                            { expression: "", from: "", to: "", includeFrom: true, includeTo: false },
                          ],
                        })
                      }
                    >
                      + Участок
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {math.kind === "qualitative" && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Опорные точки (минимум 2)</Label>
                {math.anchors.map((anchor, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{xName}</Label>
                      <Input
                        value={anchor.x}
                        className="font-mono text-xs"
                        onChange={(event) =>
                          updateGraphMath(graph.id, {
                            anchors: math.anchors.map((item, position) =>
                              position === index ? { ...item, x: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{yName}</Label>
                      <Input
                        value={anchor.y}
                        className="font-mono text-xs"
                        onChange={(event) =>
                          updateGraphMath(graph.id, {
                            anchors: math.anchors.map((item, position) =>
                              position === index ? { ...item, y: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="flex-[1.4] space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Тип</Label>
                      <Select
                        value={anchor.kind}
                        onValueChange={(value) =>
                          updateGraphMath(graph.id, {
                            anchors: math.anchors.map((item, position) =>
                              position === index ? { ...item, kind: value as AnchorKind } : item,
                            ),
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ANCHOR_KINDS.map((kind) => (
                            <SelectItem key={kind.value} value={kind.value}>{kind.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {math.anchors.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 text-muted-foreground"
                        onClick={() =>
                          updateGraphMath(graph.id, {
                            anchors: math.anchors.filter((_item, position) => position !== index),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateGraphMath(graph.id, {
                      anchors: [...math.anchors, { x: "", y: "", kind: "plain" }],
                    })
                  }
                >
                  + Опорная точка
                </Button>
                <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                  <Label className="text-xs">Гладко продолжать за крайними точками</Label>
                  <Switch
                    checked={math.extendEnds !== false}
                    onCheckedChange={(checked) =>
                      updateGraphMath(graph.id, { extendEnds: checked })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Опорные точки задают форму кривой и сами не рисуются. При продолжении кривая
                  доходит до краёв области, сохраняя наклон и кривизну крайнего участка. Видимые
                  точки добавляются в разделе «Точки».
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {math.kind === "qualitative" ? "Начало кривой" : `Пределы по ${xName}: от`}
                </Label>
                <Input
                  value={math.domainFrom}
                  placeholder="как у плоскости"
                  className="font-mono text-xs"
                  onChange={(event) => updateGraphMath(graph.id, { domainFrom: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {math.kind === "qualitative" ? "Конец кривой" : "до"}
                </Label>
                <Input
                  value={math.domainTo}
                  placeholder="как у плоскости"
                  className="font-mono text-xs"
                  onChange={(event) => updateGraphMath(graph.id, { domainTo: event.target.value })}
                />
              </div>
            </div>

            <Button type="button" variant="outline" size="sm" disabled className="w-full">
              Подобрать пределы
            </Button>

            <ColorSwatches
              value={graph.style.color}
              onChange={(color) => updateGraphStyle(graph.id, { color })}
              customColors={scene.customColors}
              onAddCustomColor={addCustomColor}
              label="Цвет графика"
            />

            {graph.error && <p className="text-xs text-destructive">{graph.error}</p>}

            <Button type="button" size="sm" className="w-full" onClick={() => buildGraph(graph.id)}>
              Построить
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
