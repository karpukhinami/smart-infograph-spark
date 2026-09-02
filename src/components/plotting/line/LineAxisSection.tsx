import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppearanceDialog } from "../AppearanceDialog";
import { usePlotStore } from "@/lib/plotting/store";
import { lineStepWarning } from "@/lib/plotting/line/render";
import { evaluateNumber } from "@/lib/plotting/math-expr";
import type { MajorLabelMode, MinorLabelMode } from "@/lib/plotting/line/types";

const MAJOR_LABEL_MODES: Array<{ value: MajorLabelMode; label: string }> = [
  { value: "all", label: "Подписать все" },
  { value: "firstTwo", label: "Подписать первые две" },
  { value: "givenTwo", label: "Подписать данные две" },
  { value: "selected", label: "Избирательно" },
];

const MINOR_LABEL_MODES: Array<{ value: MinorLabelMode; label: string }> = [
  { value: "all", label: "Подписать все" },
  { value: "oneInterval", label: "В пределах одного большого шага" },
];

export function LineAxisSection() {
  const [open, setOpen] = useState(false);
  const scene = usePlotStore((state) => state.scene);
  const line = scene.line;
  const updateLineAxis = usePlotStore((state) => state.updateLineAxis);
  const updateLineTicks = usePlotStore((state) => state.updateLineTicks);

  if (!line) return null;

  const stepWarning = (() => {
    try {
      const min = evaluateNumber(line.axis.min);
      const max = evaluateNumber(line.axis.max);
      const step = evaluateNumber(line.axis.majorStep);
      return lineStepWarning(min, max, step);
    } catch {
      return null;
    }
  })();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Числовая прямая</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-5 gap-1.5">
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-muted-foreground">Название</Label>
            <Input
              value={line.axis.name}
              className="h-8 px-2 text-sm"
              onChange={(e) => updateLineAxis({ name: e.target.value })}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-muted-foreground">Ед. изм.</Label>
            <Input
              value={line.axis.unit}
              placeholder="—"
              className="h-8 px-2 text-sm"
              onChange={(e) => updateLineAxis({ unit: e.target.value })}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-muted-foreground">Мин.</Label>
            <Input
              value={line.axis.min}
              className="h-8 px-2 font-mono text-sm"
              onChange={(e) => updateLineAxis({ min: e.target.value })}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-muted-foreground">Макс.</Label>
            <Input
              value={line.axis.max}
              className="h-8 px-2 font-mono text-sm"
              onChange={(e) => updateLineAxis({ max: e.target.value })}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-muted-foreground">Шаг засечек</Label>
            <Input
              value={line.axis.majorStep}
              className="h-8 px-2 font-mono text-sm"
              onChange={(e) => updateLineAxis({ majorStep: e.target.value })}
            />
          </div>
        </div>

        {stepWarning && <p className="text-xs text-amber-600">{stepWarning}</p>}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={line.ticks.majorVisible}
              onCheckedChange={(checked) => updateLineTicks({ majorVisible: checked })}
            />
            <Label className="text-sm">Большие засечки</Label>
          </div>
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Подписи больших засечек</Label>
            <Select
              value={line.ticks.majorLabelMode}
              onValueChange={(v) => updateLineTicks({ majorLabelMode: v as MajorLabelMode })}
            >
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MAJOR_LABEL_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {line.ticks.majorLabelMode === "givenTwo" && (
            <div className="w-28 space-y-1">
              <Label className="text-xs text-muted-foreground">Первая засечка</Label>
              <Input
                value={line.ticks.majorLabelAnchor}
                className="h-8 font-mono text-sm"
                onChange={(e) => updateLineTicks({ majorLabelAnchor: e.target.value })}
              />
            </div>
          )}
          {line.ticks.majorLabelMode === "selected" && (
            <div className="min-w-0 flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Координаты через «;»</Label>
              <Input
                value={line.ticks.majorSelectedLabels}
                placeholder="-2; 0; 1/2"
                className="h-8 font-mono text-sm"
                onChange={(e) => updateLineTicks({ majorSelectedLabels: e.target.value })}
              />
            </div>
          )}
        </div>

        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
              Ось и засечки
            </CollapsibleTrigger>
            {open && <AppearanceDialog axisScaleMode="independent" />}
          </div>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Добавить мелкие засечки</Label>
                <Switch
                  checked={line.ticks.minorEnabled}
                  onCheckedChange={(checked) => updateLineTicks({ minorEnabled: checked })}
                />
              </div>
              {line.ticks.minorEnabled && (
                <>
                  <div className="flex items-center gap-2">
                    <Label className="shrink-0 text-xs text-muted-foreground">Разделить большое деление на</Label>
                    <Input
                      value={line.ticks.minorDivisions}
                      className="h-8 w-16 font-mono text-sm"
                      onChange={(e) => updateLineTicks({ minorDivisions: e.target.value })}
                    />
                    <span className="text-xs text-muted-foreground">частей</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Подписи мелких засечек</Label>
                    <Select
                      value={line.ticks.minorLabelMode}
                      onValueChange={(v) => updateLineTicks({ minorLabelMode: v as MinorLabelMode })}
                    >
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MINOR_LABEL_MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {line.ticks.minorLabelMode === "oneInterval" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Начало большого интервала</Label>
                      <Input
                        value={line.ticks.minorLabelIntervalStart}
                        className="h-8 font-mono text-sm"
                        onChange={(e) => updateLineTicks({ minorLabelIntervalStart: e.target.value })}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
