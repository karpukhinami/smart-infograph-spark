import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { usePlotStore } from "@/lib/plotting/store";
import { derivedPointChoices, faceChoices, lineChoices, planeChoices, pointChoices } from "@/lib/plotting/space/scene";
import type { LineRegion } from "@/lib/plotting/space/types";

const REGION_OPTIONS: Array<{ value: LineRegion; label: string }> = [
  { value: "before", label: "до первой" },
  { value: "between", label: "между" },
  { value: "after", label: "после второй" },
];

export function SpacePointDraftPanel() {
  const space3d = usePlotStore((s) => s.scene.space3d);
  const draft = usePlotStore((s) => s.spacePointDraft);
  const error = usePlotStore((s) => s.spacePointDraftError);
  const update = usePlotStore((s) => s.updateSpacePointDraft);
  const cancel = usePlotStore((s) => s.cancelSpacePointDraft);
  const commit = usePlotStore((s) => s.commitSpacePointDraft);

  if (!draft || !space3d?.figure) return null;
  const choices = pointChoices(space3d);
  const faces = faceChoices(space3d);
  const lines = lineChoices(space3d);
  const planes = planeChoices(space3d);
  const derived = derivedPointChoices(space3d);

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Как задаётся точка</Label>
        <Select
          value={draft.mode}
          onValueChange={(v) => update({ mode: v as "onLine" | "onFace" | "linePlaneIntersection" | "fromConstruction" })}
        >
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="onLine">на прямой</SelectItem>
            <SelectItem value="onFace">на грани</SelectItem>
            <SelectItem value="linePlaneIntersection">пересечение прямой и плоскости</SelectItem>
            <SelectItem value="fromConstruction">из построений</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Название (необязательно)</Label>
        <Input
          value={draft.label}
          className="bg-background h-8 text-xs italic"
          placeholder="авто — первая свободная буква"
          onChange={(e) => update({ label: e.target.value })}
        />
      </div>

      {draft.mode === "onLine" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Точка 1</Label>
              <Select value={draft.pointAId} onValueChange={(v) => update({ pointAId: v })}>
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
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Точка 2</Label>
              <Select value={draft.pointBId} onValueChange={(v) => update({ pointBId: v })}>
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
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Положение</Label>
            <Select value={draft.region} onValueChange={(v) => update({ region: v as LineRegion })}>
              <SelectTrigger className="h-8 bg-background text-xs">
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
          <div className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1.5">
            <Label className="text-xs">Отношение задано</Label>
            <Switch
              checked={draft.ratioMode === "explicit"}
              onCheckedChange={(checked) => update({ ratioMode: checked ? "explicit" : "auto" })}
            />
          </div>
          {draft.ratioMode === "explicit" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={0.01}
                step={0.1}
                value={draft.ratioA}
                className="h-8 bg-background text-xs"
                onChange={(e) => update({ ratioA: Number(e.target.value) || 1 })}
              />
              <Input
                type="number"
                min={0.01}
                step={0.1}
                value={draft.ratioB}
                className="h-8 bg-background text-xs"
                onChange={(e) => update({ ratioB: Number(e.target.value) || 1 })}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Положение на прямой</Label>
              <Slider
                value={[draft.lineParam ?? 0.4]}
                min={draft.region === "before" ? -1.2 : draft.region === "after" ? 1.02 : 0.02}
                max={draft.region === "before" ? -0.02 : draft.region === "after" ? 2.2 : 0.98}
                step={0.01}
                onValueChange={([v]) => update({ lineParam: v ?? 0.4 })}
              />
            </div>
          )}
        </>
      )}

      {draft.mode === "onFace" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Грань</Label>
            <Select value={draft.faceId} onValueChange={(v) => update({ faceId: v })}>
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {faces.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Расположение</Label>
            <Select
              value={draft.placement}
              onValueChange={(v) => update({ placement: v as "arbitrary" | "center" })}
            >
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="arbitrary">произвольно</SelectItem>
                <SelectItem value="center">центр</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {draft.mode === "linePlaneIntersection" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Прямая</Label>
            <Select value={draft.lineId} onValueChange={(lineId) => update({ lineId })}>
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>{line.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Плоскость</Label>
            <Select value={draft.planeId} onValueChange={(planeId) => update({ planeId })}>
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {planes.map((plane) => (
                  <SelectItem key={plane.id} value={plane.id}>{plane.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {draft.mode === "fromConstruction" && (
        <div className="space-y-1">
          <Label className="text-xs">Построение</Label>
          <Select value={draft.derivedId} onValueChange={(derivedId) => update({ derivedId })}>
            <SelectTrigger className="h-8 bg-background text-xs">
              <SelectValue placeholder="Выберите пересечение" />
            </SelectTrigger>
            <SelectContent>
              {derived.map((choice) => (
                <SelectItem key={choice.id} value={choice.id}>{choice.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!derived.length && <p className="text-xs text-muted-foreground">Доступных пересечений пока нет.</p>}
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
