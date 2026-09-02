import { useState } from "react";
import { ChevronDown, Eye, EyeOff, Trash2 } from "lucide-react";
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
import { ColorDot } from "../ColorDot";
import { usePlotStore } from "@/lib/plotting/store";
import type { SceneLinePoint } from "@/lib/plotting/line/types";

function SideSelect({
  value,
  onChange,
}: {
  value: "above" | "below";
  onChange: (value: "above" | "below") => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as "above" | "below")}>
      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
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
      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="point">Цвет точки</SelectItem>
        <SelectItem value="axis">Цвет оси</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function LinePointCard({ point }: { point: SceneLinePoint }) {
  const [open, setOpen] = useState(false);
  const updateLinePointStyle = usePlotStore((s) => s.updateLinePointStyle);
  const updateLinePointMath = usePlotStore((s) => s.updateLinePointMath);
  const buildLinePointItem = usePlotStore((s) => s.buildLinePointItem);
  const removeLinePoint = usePlotStore((s) => s.removeLinePoint);

  return (
    <Card className="border-border">
      <CardContent className="p-2.5">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-start gap-1.5">
            <CollapsibleTrigger className="mt-2 shrink-0 text-muted-foreground">
              <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
            </CollapsibleTrigger>

            <div className="flex min-w-0 flex-1 items-end gap-2 border-r border-border pr-2">
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Название</Label>
                <Input
                  value={point.style.label}
                  placeholder={`Т${point.index}`}
                  className="h-8 w-14 px-1.5 text-xs italic"
                  onChange={(e) => updateLinePointStyle(point.id, { label: e.target.value })}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Координата</Label>
                <Input
                  value={point.math.coordinate}
                  disabled={point.locked}
                  className="h-8 min-w-0 px-1.5 font-mono text-xs"
                  onChange={(e) => updateLinePointMath(point.id, { coordinate: e.target.value })}
                  onBlur={() => !point.locked && buildLinePointItem(point.id)}
                />
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
              <ColorDot
                value={point.style.color}
                onChange={(c) => updateLinePointStyle(point.id, { color: c })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`size-8 ${point.style.visible ? "text-primary" : "text-muted-foreground"}`}
                onClick={() => updateLinePointStyle(point.id, { visible: !point.style.visible })}
              >
                {point.style.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </Button>
              {!point.locked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={() => removeLinePoint(point.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>

          <CollapsibleContent className="pt-3 pl-6">
            <div className="grid grid-cols-2 gap-3 divide-x divide-border">
              <div className="space-y-2 pr-3">
                <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                  <Label className="text-xs">Показывать подпись</Label>
                  <Switch
                    checked={point.style.showLabel}
                    onCheckedChange={(checked) => updateLinePointStyle(point.id, { showLabel: checked })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Сторона подписи</Label>
                  <SideSelect
                    value={point.style.labelSide}
                    onChange={(v) => updateLinePointStyle(point.id, { labelSide: v })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Цвет подписи</Label>
                  <ColorSelect
                    value={point.style.labelColor}
                    onChange={(v) => updateLinePointStyle(point.id, { labelColor: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                  <Label className="text-xs">Выколотая</Label>
                  <Switch
                    checked={point.style.open}
                    onCheckedChange={(checked) => updateLinePointStyle(point.id, { open: checked })}
                  />
                </div>
              </div>

              <div className="space-y-2 pl-3">
                <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                  <Label className="text-xs">Показывать координату</Label>
                  <Switch
                    checked={point.style.showCoords}
                    onCheckedChange={(checked) => updateLinePointStyle(point.id, { showCoords: checked })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Сторона координаты</Label>
                  <SideSelect
                    value={point.style.coordSide}
                    onChange={(v) => updateLinePointStyle(point.id, { coordSide: v })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Цвет координаты</Label>
                  <ColorSelect
                    value={point.style.coordColor}
                    onChange={(v) => updateLinePointStyle(point.id, { coordColor: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                  <Label className="text-xs">Провести перпендикуляр</Label>
                  <Switch
                    checked={point.style.perpendicular}
                    onCheckedChange={(checked) => updateLinePointStyle(point.id, { perpendicular: checked })}
                  />
                </div>
              </div>
            </div>
            {point.error && <p className="mt-2 text-xs text-destructive">{point.error}</p>}
          </CollapsibleContent>
        </Collapsible>
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
