import { useMemo, useState } from "react";
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
import { MathInput } from "../MathInput";
import { usePlotStore } from "@/lib/plotting/store";
import { previewFreeformInput } from "@/lib/plotting/line/intervals";
import { evaluateNumber, parseBound } from "@/lib/plotting/math-expr";
import type { SceneSet, SetDisplay, SetKind, SetPosition } from "@/lib/plotting/line/types";

const KINDS: Array<{ value: SetKind; label: string }> = [
  { value: "interval", label: "Интервал" },
  { value: "ray", label: "Луч" },
  { value: "freeform", label: "Свободный ввод" },
];

const DISPLAYS: Array<{ value: SetDisplay; label: string }> = [
  { value: "hatchRight", label: "Штриховка вправо" },
  { value: "hatchLeft", label: "Штриховка влево" },
  { value: "arc", label: "Дуга" },
  { value: "thickSegment", label: "Жирный отрезок" },
];

function useAxisExpandPrompt() {
  const scene = usePlotStore((s) => s.scene);
  const updateLineAxis = usePlotStore((s) => s.updateLineAxis);
  const line = scene.line;
  return (values: number[]) => {
    if (!line) return true;
    try {
      const min = evaluateNumber(line.axis.min);
      const max = evaluateNumber(line.axis.max);
      let newMin = min;
      let newMax = max;
      for (const v of values) {
        if (!Number.isFinite(v)) continue;
        if (v < min) newMin = Math.min(newMin, v - 1);
        if (v > max) newMax = Math.max(newMax, v + 1);
      }
      if (newMin === min && newMax === max) return true;
      const ok = window.confirm(
        `Значение выходит за пределы оси. Изменить предел?${newMin !== min ? `\nминимум → ${newMin}` : ""}${newMax !== max ? `\nмаксимум → ${newMax}` : ""}`,
      );
      if (ok) {
        updateLineAxis({
          ...(newMin !== min ? { min: String(newMin) } : {}),
          ...(newMax !== max ? { max: String(newMax) } : {}),
        });
      }
      return true;
    } catch {
      return true;
    }
  };
}

function IntervalEditor({ set, onMath }: { set: SceneSet; onMath: (patch: Partial<SceneSet["math"]>) => void }) {
  const scene = usePlotStore((s) => s.scene);
  const xName = scene.line?.axis.name.trim() || "x";
  const promptExpand = useAxisExpandPrompt();

  const checkBounds = (left: string, right: string) => {
    try {
      const lv = parseBound(left);
      const rv = parseBound(right);
      const finite = [lv, rv].filter(Number.isFinite);
      if (finite.length) promptExpand(finite);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <Input
        value={set.math.left}
        placeholder="−∞"
        className="h-8 w-14 border-primary/40 bg-primary/5 px-1.5 text-center font-mono text-xs"
        onChange={(e) => onMath({ left: e.target.value })}
        onBlur={() => checkBounds(set.math.left, set.math.right)}
      />
      <Select value={set.math.leftOp === "<=" ? "inclusive" : "strict"} onValueChange={(v) => onMath({ leftOp: v === "inclusive" ? "<=" : "<" })}>
        <SelectTrigger className="h-8 w-9 justify-center border-primary/40 bg-primary/10 px-0 text-sm text-primary [&>svg]:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="strict">&lt;</SelectItem>
          <SelectItem value="inclusive">≤</SelectItem>
        </SelectContent>
      </Select>
      <span className="italic">{xName}</span>
      <Select value={set.math.rightOp === "<=" ? "inclusive" : "strict"} onValueChange={(v) => onMath({ rightOp: v === "inclusive" ? "<=" : "<" })}>
        <SelectTrigger className="h-8 w-9 justify-center border-primary/40 bg-primary/10 px-0 text-sm text-primary [&>svg]:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="strict">&lt;</SelectItem>
          <SelectItem value="inclusive">≤</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={set.math.right}
        placeholder="+∞"
        className="h-8 w-14 border-primary/40 bg-primary/5 px-1.5 text-center font-mono text-xs"
        onChange={(e) => onMath({ right: e.target.value })}
        onBlur={() => checkBounds(set.math.left, set.math.right)}
      />
    </div>
  );
}

function RayEditor({ set, onMath }: { set: SceneSet; onMath: (patch: Partial<SceneSet["math"]>) => void }) {
  const scene = usePlotStore((s) => s.scene);
  const xName = scene.line?.axis.name.trim() || "x";
  const promptExpand = useAxisExpandPrompt();
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="italic">{xName}</span>
      <Select value={set.math.rayOp} onValueChange={(v) => onMath({ rayOp: v as SceneSet["math"]["rayOp"] })}>
        <SelectTrigger className="h-8 w-9 justify-center border-primary/40 bg-primary/10 px-0 text-sm text-primary [&>svg]:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="<">&lt;</SelectItem>
          <SelectItem value="<=">≤</SelectItem>
          <SelectItem value=">">&gt;</SelectItem>
          <SelectItem value=">=">≥</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={set.math.rayBoundary}
        className="h-8 w-20 font-mono text-xs"
        onChange={(e) => onMath({ rayBoundary: e.target.value })}
        onBlur={() => {
          try {
            promptExpand([evaluateNumber(set.math.rayBoundary)]);
          } catch {
            /* ignore */
          }
        }}
      />
    </div>
  );
}

function FreeformEditor({ set, onMath }: { set: SceneSet; onMath: (patch: Partial<SceneSet["math"]>) => void }) {
  const preview = useMemo(
    () => previewFreeformInput(set.math.freeformInput),
    [set.math.freeformInput],
  );
  return (
    <div className="space-y-1.5">
      <MathInput
        value={set.math.freeformInput}
        placeholder="(-inf; -2]; (3; +inf)"
        onChange={(value) => onMath({ freeformInput: value })}
      />
      {preview.error ? (
        <p className="text-xs text-destructive">{preview.error}</p>
      ) : preview.text ? (
        <p className="font-mono text-xs text-muted-foreground">{preview.text}</p>
      ) : null}
    </div>
  );
}

export function SetCard({ set }: { set: SceneSet }) {
  const [open, setOpen] = useState(true);
  const updateSetMath = usePlotStore((s) => s.updateSetMath);
  const updateSetStyle = usePlotStore((s) => s.updateSetStyle);
  const buildSet = usePlotStore((s) => s.buildSet);
  const removeSet = usePlotStore((s) => s.removeSet);

  const title = set.built?.displayText ?? `Множество ${set.index}`;
  const onMath = (patch: Partial<SceneSet["math"]>) => updateSetMath(set.id, patch);

  return (
    <Card className="border-border">
      <CardContent className="space-y-3 p-3">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-1.5">
            <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium">
              <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
              <span className="truncate font-mono text-xs">{title}</span>
            </CollapsibleTrigger>
            <ColorDot value={set.style.color} onChange={(c) => updateSetStyle(set.id, { color: c })} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`size-8 ${set.style.visible ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => updateSetStyle(set.id, { visible: !set.style.visible })}
            >
              {set.style.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => removeSet(set.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>

          <CollapsibleContent className="space-y-3 pt-3">
            {!set.kindLocked && (
              <Select value={set.math.kind} onValueChange={(v) => onMath({ kind: v as SetKind })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {set.math.kind === "interval" && <IntervalEditor set={set} onMath={onMath} />}
            {set.math.kind === "ray" && <RayEditor set={set} onMath={onMath} />}
            {set.math.kind === "freeform" && <FreeformEditor set={set} onMath={onMath} />}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Отображение</Label>
                <Select value={set.style.display} onValueChange={(v) => updateSetStyle(set.id, { display: v as SetDisplay })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DISPLAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Расположение</Label>
                <Select value={set.style.position} onValueChange={(v) => updateSetStyle(set.id, { position: v as SetPosition })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Над осью</SelectItem>
                    <SelectItem value="below">Под осью</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {set.error && <p className="text-xs text-destructive">{set.error}</p>}

            <Button type="button" size="sm" variant="outline" onClick={() => buildSet(set.id)}>
              <Hammer className="size-4" />
              {set.built ? "Перестроить" : "Построить"}
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export function SetDraftPanel() {
  const draft = usePlotStore((s) => s.setDraft);
  const error = usePlotStore((s) => s.setDraftError);
  const line = usePlotStore((s) => s.scene.line);
  const updateSetDraft = usePlotStore((s) => s.updateSetDraft);
  const updateSetDraftMath = usePlotStore((s) => s.updateSetDraftMath);
  const cancelSetDraft = usePlotStore((s) => s.cancelSetDraft);
  const commitSetDraft = usePlotStore((s) => s.commitSetDraft);

  if (!draft) return null;

  const onMath = (patch: Partial<SceneSet["math"]>) => updateSetDraftMath(patch);
  const canNewAxis = (line?.sets.length ?? 0) > 0;

  return (
    <Card className="border-dashed border-primary/40">
      <CardContent className="space-y-3 p-3">
        <p className="text-sm font-medium">Новое множество</p>
        <Select value={draft.math.kind} onValueChange={(v) => onMath({ kind: v as SetKind })}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {draft.math.kind === "interval" && <IntervalEditor set={draft} onMath={onMath} />}
        {draft.math.kind === "ray" && <RayEditor set={draft} onMath={onMath} />}
        {draft.math.kind === "freeform" && <FreeformEditor set={draft} onMath={onMath} />}

        <label className={`flex items-center gap-2 text-sm ${!canNewAxis ? "opacity-50" : ""}`}>
          <input
            type="checkbox"
            disabled={!canNewAxis}
            checked={draft.axisRow >= (line?.axisRowCount ?? 1)}
            onChange={(e) =>
              updateSetDraft({
                axisRow: e.target.checked ? (line?.axisRowCount ?? 1) : (line?.sets[0]?.axisRow ?? 0),
              })
            }
          />
          Перейти на новую ось
        </label>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={commitSetDraft}>Построить</Button>
          <Button type="button" size="sm" variant="outline" onClick={cancelSetDraft}>Отменить</Button>
        </div>
      </CardContent>
    </Card>
  );
}
