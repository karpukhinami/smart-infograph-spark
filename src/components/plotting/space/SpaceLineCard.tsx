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
import { pointChoices, planeChoices } from "@/lib/plotting/space/scene";
import type { LinearVisualKind, SpaceLine } from "@/lib/plotting/space/types";

export function SpaceLineCard({ line }: { line: SpaceLine }) {
  const [open, setOpen] = useState(false);
  const space3d = usePlotStore((s) => s.scene.space3d);
  const updateSpaceLine = usePlotStore((s) => s.updateSpaceLine);
  const updateSpaceLineStyle = usePlotStore((s) => s.updateSpaceLineStyle);
  const removeSpaceLine = usePlotStore((s) => s.removeSpaceLine);
  const buildSpaceLine = usePlotStore((s) => s.buildSpaceLine);

  if (!space3d?.figure) return null;
  const choices = pointChoices(space3d);
  const planes = planeChoices(space3d);
  const def = line.definition;

  return (
    <Card className="border-border">
      <CardContent className="p-2.5">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-1.5">
            <CollapsibleTrigger className="shrink-0 text-muted-foreground">
              <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
            </CollapsibleTrigger>
            <Input
              value={line.label}
              readOnly={!line.built}
              className="h-8 w-12 max-w-12 shrink-0 px-1.5 text-xs italic"
              placeholder={line.built ? "" : "—"}
              onChange={(e) => updateSpaceLine(line.id, { label: e.target.value })}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {line.error ?? (def.kind === "twoPoints" ? "через 2 точки" : "пересечение плоскостей")}
              {line.dirty ? " · изменена" : ""}
            </span>
            <ColorDot
              value={line.style.color}
              onChange={(color) => updateSpaceLineStyle(line.id, { color })}
              title="Цвет"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`size-8 ${line.style.visible ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => updateSpaceLineStyle(line.id, { visible: !line.style.visible })}
            >
              {line.style.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => removeSpaceLine(line.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>

          <CollapsibleContent className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label className="text-xs">Тип</Label>
              <Select
                value={line.style.visualKind}
                onValueChange={(v) => updateSpaceLineStyle(line.id, { visualKind: v as LinearVisualKind })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="segment">отрезок</SelectItem>
                  <SelectItem value="line">прямая</SelectItem>
                  <SelectItem value="vector">вектор</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {def.kind === "twoPoints" && (
              <div className="grid grid-cols-2 gap-2">
                <Select value={def.aId} onValueChange={(v) => updateSpaceLine(line.id, { definition: { ...def, aId: v } })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Точка 1" />
                  </SelectTrigger>
                  <SelectContent>
                    {choices.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={def.bId} onValueChange={(v) => updateSpaceLine(line.id, { definition: { ...def, bId: v } })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Точка 2" />
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
            )}
            {def.kind === "planeIntersection" && (
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={def.planeAId}
                  onValueChange={(v) =>
                    updateSpaceLine(line.id, { definition: { ...def, planeAId: v } })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Плоскость 1" />
                  </SelectTrigger>
                  <SelectContent>
                    {planes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={def.planeBId}
                  onValueChange={(v) =>
                    updateSpaceLine(line.id, { definition: { ...def, planeBId: v } })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Плоскость 2" />
                  </SelectTrigger>
                  <SelectContent>
                    {planes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(line.dirty || line.error) && (
              <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => buildSpaceLine(line.id)}>
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
