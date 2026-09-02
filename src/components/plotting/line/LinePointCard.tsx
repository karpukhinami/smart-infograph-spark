import { ChevronDown, Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ColorDot } from "../ColorDot";
import { usePlotStore } from "@/lib/plotting/store";
import type { SceneLinePoint } from "@/lib/plotting/line/types";

function SideSelect({
  value,
  onChange,
  className,
}: {
  value: "above" | "below";
  onChange: (value: "above" | "below") => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as "above" | "below")}>
      <SelectTrigger className={className ?? "h-7 w-[4.5rem] px-1.5 text-[10px]"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="above">Сверху</SelectItem>
        <SelectItem value="below">Снизу</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ColorSelect({
  value,
  onChange,
}: {
  value: "point" | "axis";
  onChange: (value: "point" | "axis") => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as "point" | "axis")}>
      <SelectTrigger className="h-7 w-[5.5rem] px-1.5 text-[10px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="point">Точка</SelectItem>
        <SelectItem value="axis">Ось</SelectItem>
      </SelectContent>
    </Select>
  );
}

function InlineSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5">
      <span className="text-[10px] leading-none text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="scale-[0.72]" />
    </label>
  );
}

export function LinePointCard({ point }: { point: SceneLinePoint }) {
  const updateLinePointStyle = usePlotStore((s) => s.updateLinePointStyle);
  const updateLinePointMath = usePlotStore((s) => s.updateLinePointMath);
  const buildLinePointItem = usePlotStore((s) => s.buildLinePointItem);
  const removeLinePoint = usePlotStore((s) => s.removeLinePoint);

  return (
    <Card className="border-border">
      <CardContent className="p-2">
        <div className="flex items-center gap-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 border-r border-border pr-1.5">
            <Input
              value={point.style.label}
              placeholder={`Т${point.index}`}
              title="Название"
              className="h-7 w-11 shrink-0 px-1.5 text-xs italic"
              onChange={(e) => updateLinePointStyle(point.id, { label: e.target.value })}
            />
            <Input
              value={point.math.coordinate}
              disabled={point.locked}
              title="Координата"
              className="h-7 w-[5.5rem] shrink-0 px-1.5 font-mono text-[11px]"
              onChange={(e) => updateLinePointMath(point.id, { coordinate: e.target.value })}
              onBlur={() => !point.locked && buildLinePointItem(point.id)}
            />

            <InlineSwitch
              label="Подпись"
              checked={point.style.showLabel}
              onCheckedChange={(checked) => updateLinePointStyle(point.id, { showLabel: checked })}
            />
            <SideSelect
              value={point.style.labelSide}
              onChange={(v) => updateLinePointStyle(point.id, { labelSide: v })}
            />
            <ColorSelect
              value={point.style.labelColor}
              onChange={(v) => updateLinePointStyle(point.id, { labelColor: v })}
            />
            <InlineSwitch
              label="Выкол."
              checked={point.style.open}
              onCheckedChange={(checked) => updateLinePointStyle(point.id, { open: checked })}
            />

            <div className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />

            <InlineSwitch
              label="Коорд."
              checked={point.style.showCoords}
              onCheckedChange={(checked) => updateLinePointStyle(point.id, { showCoords: checked })}
            />
            <SideSelect
              value={point.style.coordSide}
              onChange={(v) => updateLinePointStyle(point.id, { coordSide: v })}
            />
            <ColorSelect
              value={point.style.coordColor}
              onChange={(v) => updateLinePointStyle(point.id, { coordColor: v })}
            />
            <InlineSwitch
              label="Перп."
              checked={point.style.perpendicular}
              onCheckedChange={(checked) => updateLinePointStyle(point.id, { perpendicular: checked })}
            />
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <ColorDot
              value={point.style.color}
              onChange={(c) => updateLinePointStyle(point.id, { color: c })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`size-7 ${point.style.visible ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => updateLinePointStyle(point.id, { visible: !point.style.visible })}
            >
              {point.style.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </Button>
            {!point.locked && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                onClick={() => removeLinePoint(point.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        {point.error && <p className="mt-1.5 text-xs text-destructive">{point.error}</p>}
      </CardContent>
    </Card>
  );
}

export function LinePointDraftPanel() {
  const draft = usePlotStore((s) => s.linePointDraft);
  const error = usePlotStore((s) => s.linePointDraftError);
  const line = usePlotStore((s) => s.scene.line);
  const updateLinePointDraftMath = usePlotStore((s) => s.updateLinePointDraftMath);
  const cancelLinePointDraft = usePlotStore((s) => s.cancelLinePointDraft);
  const commitLinePointDraft = usePlotStore((s) => s.commitLinePointDraft);
  const updateLinePointDraft = usePlotStore((s) => s.updateLinePointDraft);

  if (!draft) return null;

  return (
    <Card className="border-dashed border-primary/40">
      <CardContent className="space-y-3 p-3">
        <p className="text-sm font-medium">Новая точка</p>
        <Input
          value={draft.math.coordinate}
          placeholder="координата"
          className="font-mono text-sm"
          onChange={(e) => updateLinePointDraftMath({ coordinate: e.target.value })}
        />
        {(line?.axisRowCount ?? 1) > 1 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ось (ряд)</Label>
            <Select
              value={String(draft.axisRow)}
              onValueChange={(v) => updateLinePointDraft({ axisRow: Number(v) })}
            >
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: line?.axisRowCount ?? 1 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>Ось {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={commitLinePointDraft}>Отметить</Button>
          <Button type="button" size="sm" variant="outline" onClick={cancelLinePointDraft}>Отменить</Button>
        </div>
      </CardContent>
    </Card>
  );
}
