import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppearanceDialog } from "./AppearanceDialog";
import { usePlotStore } from "@/lib/plotting/store";
import {
  PLOT_ASPECT_RATIO_OPTIONS,
  type AxisScaleMode,
  type MarkRule,
  type PlotAspectRatio,
  type TickLabelFormat,
} from "@/lib/plotting/types";

const MARK_RULES: Array<{ value: MarkRule; label: string }> = [
  { value: "zeroOnly", label: "Только 0" },
  { value: "zeroAndFirst", label: "0 и первое деление" },
  { value: "all", label: "Все засечки" },
  { value: "selected", label: "Избирательно" },
];

const LABEL_FORMATS: Array<{ value: TickLabelFormat; label: string }> = [
  { value: "number", label: "обычные числа" },
  { value: "fraction", label: "дроби" },
  { value: "pi", label: "через π" },
];

function AxisMainFields({ axis, title }: { axis: "xAxis" | "yAxis"; title: string }) {
  const spec = usePlotStore((state) => state.scene[axis]);
  const updateAxis = usePlotStore((state) => state.updateAxis);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid grid-cols-5 gap-1.5">
        <div className="min-w-0 space-y-1">
          <Label className="text-xs text-muted-foreground">Название</Label>
          <Input
            value={spec.name}
            className="h-8 px-2 text-sm"
            onChange={(event) => updateAxis(axis, { name: event.target.value })}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs text-muted-foreground">Ед. изм.</Label>
          <Input
            value={spec.unit}
            placeholder="—"
            className="h-8 px-2 text-sm"
            onChange={(event) => updateAxis(axis, { unit: event.target.value })}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs text-muted-foreground">Мин.</Label>
          <Input
            value={spec.min}
            className="h-8 px-2 font-mono text-sm"
            onChange={(event) => updateAxis(axis, { min: event.target.value })}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs text-muted-foreground">Макс.</Label>
          <Input
            value={spec.max}
            className="h-8 px-2 font-mono text-sm"
            onChange={(event) => updateAxis(axis, { max: event.target.value })}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs text-muted-foreground">Шаг сетки</Label>
          <Input
            value={spec.gridStep}
            placeholder="1"
            className="h-8 px-2 font-mono text-sm"
            onChange={(event) => updateAxis(axis, { gridStep: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function AxisDetails({ axis, title }: { axis: "xAxis" | "yAxis"; title: string }) {
  const spec = usePlotStore((state) => state.scene[axis]);
  const updateAxis = usePlotStore((state) => state.updateAxis);
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-medium">{title}</p>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Формат подписей</Label>
        <Select
          value={spec.labelFormat}
          onValueChange={(value) => updateAxis(axis, { labelFormat: value as TickLabelFormat })}
        >
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LABEL_FORMATS.map((format) => (
              <SelectItem key={format.value} value={format.value}>{format.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-[1fr,minmax(5rem,7rem)] gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Засечки и подписи</Label>
          <Select
            value={spec.markRule}
            onValueChange={(value) => updateAxis(axis, { markRule: value as MarkRule })}
          >
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MARK_RULES.map((rule) => (
                <SelectItem key={rule.value} value={rule.value}>{rule.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Шаг подписи</Label>
          <Input
            value={spec.labelStep}
            placeholder={spec.gridStep || "1"}
            className="h-8 px-2 font-mono text-sm"
            disabled={spec.markRule === "selected"}
            onChange={(event) => updateAxis(axis, { labelStep: event.target.value })}
          />
        </div>
      </div>

      {spec.markRule === "selected" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Позиции засечек</Label>
          <Input
            value={spec.selectedMarks}
            placeholder="например -4, 0, 2, 6 или 0, pi/2, pi"
            className="font-mono text-sm"
            onChange={(event) => updateAxis(axis, { selectedMarks: event.target.value })}
          />
        </div>
      )}
    </div>
  );
}

function PlotAspectField() {
  const plotAspectRatio = usePlotStore((state) => state.scene.plotAspectRatio);
  const updateAxisScale = usePlotStore((state) => state.updateAxisScale);
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">Форма графика</Label>
      <Select
        value={plotAspectRatio}
        onValueChange={(value) => updateAxisScale({ plotAspectRatio: value as PlotAspectRatio })}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {PLOT_ASPECT_RATIO_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
              {option.value === "4:3" ? " — по умолчанию" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Относится к рабочей области построения, не меняет математические параметры сцены.
      </p>
    </div>
  );
}

export function AxesSection() {
  const [open, setOpen] = useState(false);
  const scene = usePlotStore((state) => state.scene);
  const axisScaleMode = scene.axisScaleMode;
  const updateAxisScale = usePlotStore((state) => state.updateAxisScale);
  const updateGrid = usePlotStore((state) => state.updateGrid);
  const independent = axisScaleMode === "independent";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Координатная плоскость</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm">Режим масштаба осей</Label>
          <RadioGroup
            value={axisScaleMode}
            onValueChange={(value) => updateAxisScale({ axisScaleMode: value as AxisScaleMode })}
            className="grid gap-2"
          >
            <div className="flex items-start gap-2 rounded-md border border-border p-3">
              <RadioGroupItem value="equal" id="axis-scale-equal" className="mt-0.5" />
              <Label htmlFor="axis-scale-equal" className="cursor-pointer space-y-0.5 font-normal">
                <span className="block text-sm font-medium">Одинаковая размерность осей</span>
                <span className="block text-xs text-muted-foreground">
                  Алгебраические графики: квадратная сетка, общий масштаб по X и Y.
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-border p-3">
              <RadioGroupItem value="independent" id="axis-scale-independent" className="mt-0.5" />
              <Label htmlFor="axis-scale-independent" className="cursor-pointer space-y-0.5 font-normal">
                <span className="block text-sm font-medium">Разная размерность осей</span>
                <span className="block text-xs text-muted-foreground">
                  Физические и статистические зависимости: независимые шкалы и шаг сетки.
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        <AxisMainFields axis="xAxis" title="Горизонтальная ось" />
        <AxisMainFields axis="yAxis" title="Вертикальная ось" />

        {independent && <PlotAspectField />}

        <Button type="button" variant="outline" size="sm" disabled className="w-full">
          Подобрать пределы
        </Button>

        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
              Оси и сетка
            </CollapsibleTrigger>
            {open && <AppearanceDialog axisScaleMode={axisScaleMode} />}
          </div>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label className="text-sm">Показывать сетку</Label>
              <Switch
                checked={scene.grid.visible}
                onCheckedChange={(checked) => updateGrid({ visible: checked })}
              />
            </div>
            <AxisDetails axis="xAxis" title="Горизонтальная ось" />
            <AxisDetails axis="yAxis" title="Вертикальная ось" />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
