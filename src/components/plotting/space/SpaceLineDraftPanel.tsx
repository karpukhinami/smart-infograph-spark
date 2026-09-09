import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlotStore } from "@/lib/plotting/store";
import { planeChoices, pointChoices } from "@/lib/plotting/space/scene";
import type { LinearVisualKind } from "@/lib/plotting/space/types";

export function SpaceLineDraftPanel() {
  const space3d = usePlotStore((s) => s.scene.space3d);
  const draft = usePlotStore((s) => s.spaceLineDraft);
  const error = usePlotStore((s) => s.spaceLineDraftError);
  const update = usePlotStore((s) => s.updateSpaceLineDraft);
  const cancel = usePlotStore((s) => s.cancelSpaceLineDraft);
  const commit = usePlotStore((s) => s.commitSpaceLineDraft);

  if (!draft || !space3d?.figure) return null;
  const choices = pointChoices(space3d);
  const planes = planeChoices(space3d);

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Способ</Label>
        <Select
          value={draft.kind}
          onValueChange={(v) => update({ kind: v as "twoPoints" | "planeIntersection" })}
        >
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="twoPoints">через две точки</SelectItem>
            <SelectItem value="planeIntersection">пересечение двух плоскостей</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Тип линии</Label>
        <Select
          value={draft.visualKind}
          onValueChange={(v) => update({ visualKind: v as LinearVisualKind })}
        >
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="segment">отрезок</SelectItem>
            <SelectItem value="line">прямая</SelectItem>
            {draft.kind === "twoPoints" && <SelectItem value="vector">вектор</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {draft.kind === "twoPoints" && (
        <div className="grid grid-cols-2 gap-2">
          <Select value={draft.aId} onValueChange={(v) => update({ aId: v })}>
            <SelectTrigger className="h-8 bg-background text-xs">
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
          <Select value={draft.bId} onValueChange={(v) => update({ bId: v })}>
            <SelectTrigger className="h-8 bg-background text-xs">
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

      {draft.kind === "planeIntersection" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Плоскость 1</Label>
            <Select value={draft.planeAId} onValueChange={(v) => update({ planeAId: v })}>
              <SelectTrigger className="h-8 bg-background text-xs">
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
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Плоскость 2</Label>
            <Select value={draft.planeBId} onValueChange={(v) => update({ planeBId: v })}>
              <SelectTrigger className="h-8 bg-background text-xs">
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
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" size="sm" className="flex-1" onClick={commit}>
          <Hammer className="size-4" />
          Построить
        </Button>
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={cancel}>
          Отменить
        </Button>
      </div>
    </div>
  );
}
