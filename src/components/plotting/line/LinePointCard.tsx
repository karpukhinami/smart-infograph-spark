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

export function LinePointCard({ point }: { point: SceneLinePoint }) {
  const [open, setOpen] = useState(false);
  const updateLinePointStyle = usePlotStore((s) => s.updateLinePointStyle);
  const updateLinePointMath = usePlotStore((s) => s.updateLinePointMath);
  const buildLinePointItem = usePlotStore((s) => s.buildLinePointItem);
  const removeLinePoint = usePlotStore((s) => s.removeLinePoint);

  const coord = point.built?.displayX ?? point.math.coordinate;

  return (
    <Card className="border-border">
      <CardContent className="p-2.5">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-1.5">
            <CollapsibleTrigger className="shrink-0 text-muted-foreground">
              <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
            </CollapsibleTrigger>
            <Input
              value={point.style.label}
              placeholder={`Точка ${point.index}`}
              className="h-8 w-[4.5rem] shrink-0 px-2 text-xs italic"
              onChange={(e) => updateLinePointStyle(point.id, { label: e.target.value })}
            />
            <Input
              value={point.math.coordinate}
              disabled={point.locked}
              className="h-8 min-w-0 flex-1 font-mono text-xs"
              onChange={(e) => updateLinePointMath(point.id, { coordinate: e.target.value })}
              onBlur={() => !point.locked && buildLinePointItem(point.id)}
            />
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
              <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => removeLinePoint(point.id)}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>

          <CollapsibleContent className="space-y-3 pt-3">
            <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
              <Label className="text-xs">Выколотая</Label>
              <Switch
                checked={point.style.open}
                onCheckedChange={(checked) => updateLinePointStyle(point.id, { open: checked })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
              <Label className="text-xs">Показывать координату</Label>
              <Switch
                checked={point.style.showCoords}
                onCheckedChange={(checked) => updateLinePointStyle(point.id, { showCoords: checked })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
              <Label className="text-xs">Провести перпендикуляр</Label>
              <Switch
                checked={point.style.perpendicular}
                onCheckedChange={(checked) => updateLinePointStyle(point.id, { perpendicular: checked })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Имя — сторона</Label>
                <Select value={point.style.labelSide} onValueChange={(v) => updateLinePointStyle(point.id, { labelSide: v as "above" | "below" })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Сверху</SelectItem>
                    <SelectItem value="below">Снизу</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Имя — цвет</Label>
                <Select value={point.style.labelColor} onValueChange={(v) => updateLinePointStyle(point.id, { labelColor: v as "point" | "axis" })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="point">Цвет точки</SelectItem>
                    <SelectItem value="axis">Цвет оси</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Координата — сторона</Label>
                <Select value={point.style.coordSide} onValueChange={(v) => updateLinePointStyle(point.id, { coordSide: v as "above" | "below" })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Сверху</SelectItem>
                    <SelectItem value="below">Снизу</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Координата — цвет</Label>
                <Select value={point.style.coordColor} onValueChange={(v) => updateLinePointStyle(point.id, { coordColor: v as "point" | "axis" })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="point">Цвет точки</SelectItem>
                    <SelectItem value="axis">Цвет оси</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {point.error && <p className="text-xs text-destructive">{point.error}</p>}
            {!point.locked && coord && (
              <p className="font-mono text-xs text-muted-foreground">x = {coord}</p>
            )}
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
