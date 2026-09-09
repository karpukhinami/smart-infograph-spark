import { useState } from "react";
import { ChevronDown, Eye, EyeOff, Hammer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ColorDot } from "../ColorDot";
import { usePlotStore } from "@/lib/plotting/store";
import { pointChoices } from "@/lib/plotting/space/scene";
import type { LineRegion, SpacePoint } from "@/lib/plotting/space/types";

const REGION_OPTIONS: Array<{ value: LineRegion; label: string }> = [
  { value: "before", label: "до первой" },
  { value: "between", label: "между" },
  { value: "after", label: "после второй" },
];

export function SpacePointCard({ point }: { point: SpacePoint }) {
  const [open, setOpen] = useState(false);
  const space3d = usePlotStore((s) => s.scene.space3d);
  const updateSpacePoint = usePlotStore((s) => s.updateSpacePoint);
  const updateSpacePointStyle = usePlotStore((s) => s.updateSpacePointStyle);
  const updateSpacePointOnLine = usePlotStore((s) => s.updateSpacePointOnLine);
  const removeSpacePoint = usePlotStore((s) => s.removeSpacePoint);
  const buildSpacePoint = usePlotStore((s) => s.buildSpacePoint);

  if (!space3d?.figure) return null;
  const choices = pointChoices(space3d);
  const def = point.definition;

  return (
    <Card className="border-border">
      <CardContent className="p-2.5">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-1.5">
            <CollapsibleTrigger className="shrink-0 text-muted-foreground">
              <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
            </CollapsibleTrigger>
            <Input
              value={point.label}
              className="h-8 w-12 max-w-12 shrink-0 px-1.5 text-xs italic"
              onChange={(e) => updateSpacePoint(point.id, { label: e.target.value })}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {def.kind === "onLine" ? "на прямой" : def.kind === "onFace" ? "на грани" : ""}
              {!point.built ? " · не построена" : point.dirty ? " · изменена" : ""}
              {point.error ? ` · ${point.error}` : ""}
            </span>
            <ColorDot
              value={point.style.color}
              onChange={(color) => updateSpacePointStyle(point.id, { color })}
              title="Цвет"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`size-8 ${point.style.visible ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => updateSpacePointStyle(point.id, { visible: !point.style.visible })}
            >
              {point.style.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => removeSpacePoint(point.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>

          <CollapsibleContent className="space-y-3 pt-3">
            {def.kind === "onLine" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Точка 1</Label>
                    <Select
                      value={def.pointAId}
                      onValueChange={(v) => updateSpacePointOnLine(point.id, { pointAId: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {choices.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Точка 2</Label>
                    <Select
                      value={def.pointBId}
                      onValueChange={(v) => updateSpacePointOnLine(point.id, { pointBId: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {choices.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Положение</Label>
                  <Select
                    value={def.region}
                    onValueChange={(v) => updateSpacePointOnLine(point.id, { region: v as LineRegion })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REGION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                  <Label className="text-xs">Отношение задано</Label>
                  <Switch
                    checked={def.ratioMode === "explicit"}
                    onCheckedChange={(checked) =>
                      updateSpacePointOnLine(point.id, { ratioMode: checked ? "explicit" : "auto" })
                    }
                  />
                </div>
                {def.ratioMode === "explicit" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={0.01}
                      step={0.1}
                      value={def.ratioA}
                      className="h-8 text-xs"
                      onChange={(e) =>
                        updateSpacePointOnLine(point.id, { ratioA: Number(e.target.value) || 1 })
                      }
                    />
                    <Input
                      type="number"
                      min={0.01}
                      step={0.1}
                      value={def.ratioB}
                      className="h-8 text-xs"
                      onChange={(e) =>
                        updateSpacePointOnLine(point.id, { ratioB: Number(e.target.value) || 1 })
                      }
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Положение на прямой</Label>
                    <Slider
                      value={[def.lineParam ?? 0.4]}
                      min={def.region === "before" ? -1.2 : def.region === "after" ? 1.02 : 0.02}
                      max={def.region === "before" ? -0.02 : def.region === "after" ? 2.2 : 0.98}
                      step={0.01}
                      onValueChange={([v]) => updateSpacePointOnLine(point.id, { lineParam: v ?? 0.4 })}
                    />
                  </div>
                )}
              </>
            )}
            {def.kind === "onFace" && (
              <div className="space-y-1">
                <Label className="text-xs">Расположение</Label>
                <Select
                  value={def.placement}
                  onValueChange={(v) =>
                    updateSpacePoint(point.id, {
                      definition: { ...def, placement: v as "arbitrary" | "center" },
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="arbitrary">Произвольно</SelectItem>
                    <SelectItem value="center">Центр</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(point.dirty || point.error || !point.built) && (
              <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => buildSpacePoint(point.id)}>
                <Hammer className="size-4" />
                {point.built ? "Перестроить" : "Построить"}
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
