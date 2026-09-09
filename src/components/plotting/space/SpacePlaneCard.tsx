import { useState } from "react";
import { ChevronDown, Eye, EyeOff, Hammer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ColorDot } from "../ColorDot";
import { usePlotStore } from "@/lib/plotting/store";
import { lineChoices, pointChoices } from "@/lib/plotting/space/scene";
import type { SpacePlane, SpacePlaneDefinition } from "@/lib/plotting/space/types";
import { SpacePlaneLinePickers } from "./SpacePlaneLinePickers";

export function SpacePlaneCard({ plane }: { plane: SpacePlane }) {
  const [open, setOpen] = useState(false);
  const space3d = usePlotStore((s) => s.scene.space3d);
  const updateSpacePlane = usePlotStore((s) => s.updateSpacePlane);
  const updateSpacePlaneStyle = usePlotStore((s) => s.updateSpacePlaneStyle);
  const removeSpacePlane = usePlotStore((s) => s.removeSpacePlane);
  const buildSpacePlane = usePlotStore((s) => s.buildSpacePlane);

  if (!space3d?.figure) return null;
  const choices = pointChoices(space3d);
  const lines = lineChoices(space3d);
  const def = plane.definition;

  const defaultLineIds = (): [string, string] => {
    const a = lines[0]?.id ?? "";
    const b = lines[1]?.id ?? lines[0]?.id ?? "";
    return [a, b];
  };

  const setDef = (next: SpacePlaneDefinition) => updateSpacePlane(plane.id, { definition: next });

  return (
    <Card className="border-border">
      <CardContent className="p-2.5">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-1.5">
            <CollapsibleTrigger className="shrink-0 text-muted-foreground">
              <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
            </CollapsibleTrigger>
            <Input
              value={plane.label}
              readOnly={!plane.built}
              className="h-8 w-12 max-w-12 shrink-0 px-1.5 text-xs italic"
              placeholder={plane.built ? "" : "—"}
              onChange={(e) => updateSpacePlane(plane.id, { label: e.target.value })}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {plane.error ?? "плоскость"}
              {plane.dirty ? " · изменена" : ""}
            </span>
            <ColorDot
              value={plane.style.color}
              onChange={(color) => updateSpacePlaneStyle(plane.id, { color })}
              title="Цвет"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`size-8 ${plane.style.visible ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => updateSpacePlaneStyle(plane.id, { visible: !plane.style.visible })}
            >
              {plane.style.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => removeSpacePlane(plane.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>

          <CollapsibleContent className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label className="text-xs">Способ</Label>
              <Select
                value={def.kind}
                onValueChange={(kind) => {
                  const verts = choices.slice(0, 3).map((c) => c.id);
                  const [lineA, lineB] = defaultLineIds();
                  if (kind === "threePoints") {
                    setDef({ kind, aId: verts[0] ?? "", bId: verts[1] ?? "", cId: verts[2] ?? "" });
                  } else if (kind === "pointAndLine") {
                    setDef({ kind, pointId: verts[0] ?? "", lineId: lineA });
                  } else if (kind === "twoLines") {
                    setDef({ kind, lineAId: lineA, lineBId: lineB });
                  } else {
                    setDef({
                      kind: "lineParallelToLine",
                      throughLineId: lineA,
                      parallelToLineId: lineB,
                    });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="threePoints">через три точки</SelectItem>
                  <SelectItem value="pointAndLine">через точку и прямую</SelectItem>
                  <SelectItem value="twoLines">через две прямые</SelectItem>
                  <SelectItem value="lineParallelToLine">через прямую ∥ другой</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {def.kind === "threePoints" && (
              <div className="grid grid-cols-3 gap-1">
                {(["aId", "bId", "cId"] as const).map((key) => (
                  <Select
                    key={key}
                    value={def[key]}
                    onValueChange={(v) => setDef({ ...def, [key]: v })}
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
                ))}
              </div>
            )}
            {def.kind === "pointAndLine" && (
              <div className="grid grid-cols-2 gap-1">
                <Select value={def.pointId} onValueChange={(v) => setDef({ ...def, pointId: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Точка" />
                  </SelectTrigger>
                  <SelectContent>
                    {choices.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={def.lineId} onValueChange={(v) => setDef({ ...def, lineId: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Прямая" />
                  </SelectTrigger>
                  <SelectContent>
                    {lines.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {def.kind === "twoLines" && (
              <SpacePlaneLinePickers
                space3d={space3d}
                lineAId={def.lineAId}
                lineBId={def.lineBId}
                onLineA={(lineAId) => setDef({ ...def, lineAId })}
                onLineB={(lineBId) => setDef({ ...def, lineBId })}
              />
            )}
            {def.kind === "lineParallelToLine" && (
              <SpacePlaneLinePickers
                space3d={space3d}
                lineAId={def.throughLineId}
                lineBId={def.parallelToLineId}
                labelA="Прямая (через неё)"
                labelB="Параллельно"
                onLineA={(throughLineId) => setDef({ ...def, throughLineId })}
                onLineB={(parallelToLineId) => setDef({ ...def, parallelToLineId })}
              />
            )}
            {(plane.dirty || plane.error) && (
              <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => buildSpacePlane(plane.id)}>
                <Hammer className="size-4" />
                Перестроить
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
