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
import { pointChoices } from "@/lib/plotting/space/scene";
import type { SpacePlaneDefinition } from "@/lib/plotting/space/types";

export function SpacePlaneDraftPanel() {
  const space3d = usePlotStore((s) => s.scene.space3d);
  const draft = usePlotStore((s) => s.spacePlaneDraft);
  const error = usePlotStore((s) => s.spacePlaneDraftError);
  const update = usePlotStore((s) => s.updateSpacePlaneDraft);
  const cancel = usePlotStore((s) => s.cancelSpacePlaneDraft);
  const commit = usePlotStore((s) => s.commitSpacePlaneDraft);

  if (!draft || !space3d?.figure) return null;
  const choices = pointChoices(space3d);
  const def = draft.definition;

  const setKind = (kind: SpacePlaneDefinition["kind"]) => {
    const verts = choices.slice(0, 3).map((c) => c.id);
    if (kind === "threePoints") {
      update({ definition: { kind, aId: verts[0] ?? "", bId: verts[1] ?? "", cId: verts[2] ?? "" } });
    } else if (kind === "pointAndLine") {
      update({
        definition: { kind, pointId: verts[0] ?? "", lineId: space3d.lines[0]?.id ?? "" },
      });
    } else if (kind === "twoLines") {
      update({
        definition: {
          kind,
          lineAId: space3d.lines[0]?.id ?? "",
          lineBId: space3d.lines[1]?.id ?? space3d.lines[0]?.id ?? "",
        },
      });
    } else {
      update({
        definition: {
          kind: "lineParallelToLine",
          throughLineId: space3d.lines[0]?.id ?? "",
          parallelToLineId: space3d.lines[1]?.id ?? space3d.lines[0]?.id ?? "",
        },
      });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Способ</Label>
        <Select value={def.kind} onValueChange={(v) => setKind(v as SpacePlaneDefinition["kind"])}>
          <SelectTrigger className="bg-background">
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
            <Select key={key} value={def[key]} onValueChange={(v) => update({ definition: { ...def, [key]: v } })}>
              <SelectTrigger className="h-8 bg-background text-xs">
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

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" size="sm" className="flex-1" onClick={commit}>
          Добавить
        </Button>
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={cancel}>
          Отменить
        </Button>
      </div>
    </div>
  );
}
