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
import { niceStep } from "@/lib/plotting/ticks";
import { displayNumber } from "@/lib/plotting/math-expr";
import { resolveGeometry } from "@/lib/plotting/render";
import {
  PLOT_ASPECT_RATIO_OPTIONS,
  type AxisScaleMode,
  type AxisSpec,
  type MarkRule,
  type PlotAspectRatio,
  type TickLabelFormat,
} from "@/lib/plotting/types";

const MARK_RULES: Array<{ value: MarkRule; label: string }> = [
  { value: "zeroOnly", label: "только 0" },
  { value: "zeroAndFirst", label: "0 и первые деления" },
  { value: "all", label: "везде" },
  { value: "selected", label: "избирательно" },
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Название</Label>
          <Input value={spec.name} onChange={(event) => updateAxis(axis, { name: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Единица измерения</Label>
          <Input
            value={spec.unit}
            placeholder="необязательно"
            onChange={(event) => updateAxis(axis, { unit: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Минимум</Label>
          <Input
            value={spec.min}
            className="font-mono"
            onChange={(event) => updateAxis(axis, { min: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Максимум</Label>
          <Input
            value={spec.max}
            className="font-mono"
            onChange={(event) => updateAxis(axis, { max: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function AxisDetails({ axis, title, autoStep }: { axis: "xAxis" | "yAxis"; title: string; autoStep: number | null }) {
  const spec = usePlotStore((state) => state.scene[axis]) as AxisSpec;
  const updateAxis = usePlotStore((state) => state.updateAxis);
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-medium">{title}</p>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Вид оси</Label>
        <RadioGroup
          value={spec.mode}
          onValueChange={(value) => updateAxis(axis, { mode: value as AxisSpec["mode"] })}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="full" id={`${axis}-full`} />
            <Label htmlFor={`${axis}-full`} className="text-sm font-normal">полная ось</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="positive" id={`${axis}-positive`} />
            <Label htmlFor={`${axis}-positive`} className="text-sm font-normal">только положительная часть</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            Цена деления {spec.stepAuto && autoStep !== null ? `(авто: ${displayNumber(autoStep, spec.labelFormat)})` : ""}
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">авто</span>
            <Switch
              checked={spec.stepAuto}
              onCheckedChange={(checked) => updateAxis(axis, { stepAuto: checked })}
            />
          </div>
        </div>
        {!spec.stepAuto && (
          <Input
            value={spec.step}
            placeholder="например 0.5, 1/4, pi/2"
            className="font-mono"
            onChange={(event) => updateAxis(axis, { step: event.target.value })}
          />
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Формат подписей</Label>
        <Select
          value={spec.labelFormat}
          onValueChange={(value) => updateAxis(axis, { labelFormat: value as TickLabelFormat })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LABEL_FORMATS.map((format) => (
              <SelectItem key={format.value} value={format.value}>{format.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Засечки и подписи</Label>
        <RadioGroup
          value={spec.markRule}
          onValueChange={(value) => updateAxis(axis, { markRule: value as MarkRule })}
          className="grid grid-cols-2 gap-2"
        >
          {MARK_RULES.map((rule) => (
            <div key={rule.value} className="flex items-center gap-2">
              <RadioGroupItem value={rule.value} id={`${axis}-${rule.value}`} />
              <Label htmlFor={`${axis}-${rule.value}`} className="text-sm font-normal">{rule.label}</Label>
            </div>
          ))}
        </RadioGroup>
        {spec.markRule === "selected" && (
          <Input
            value={spec.selectedMarks}
            placeholder="например -4, 0, 2, 6 или 0, pi/2, pi"
            className="font-mono"
            onChange={(event) => updateAxis(axis, { selectedMarks: event.target.value })}
          />
        )}
      </div>
    </div>
  );
}

function IndependentGridFields() {
  const grid = usePlotStore((state) => state.scene.grid);
  const updateGrid = usePlotStore((state) => state.updateGrid);
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-sm font-medium">Шаг сетки</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">По горизонтали</Label>
          <Input
            value={grid.stepX}
            placeholder="например 2"
            className="font-mono"
            onChange={(event) => updateGrid({ stepX: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">По вертикали</Label>
          <Input
            value={grid.stepY}
            placeholder="например 100"
            className="font-mono"
            onChange={(event) => updateGrid({ stepY: event.target.value })}
          />
        </div>
      </div>
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
  const geometry = resolveGeometry(scene);
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

        {independent && (
          <>
            <IndependentGridFields />
            <PlotAspectField />
          </>
        )}

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
            <AxisDetails
              axis="xAxis"
              title="Горизонтальная ось"
              autoStep={geometry ? niceStep(geometry.xMin, geometry.xMax) : null}
            />
            <AxisDetails
              axis="yAxis"
              title="Вертикальная ось"
              autoStep={geometry ? niceStep(geometry.yMin, geometry.yMax) : null}
            />
            <Separator />
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Показывать сетку</Label>
                <Switch
                  checked={scene.grid.visible}
                  onCheckedChange={(checked) => updateGrid({ visible: checked })}
                />
              </div>
              {!independent && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Шаг сетки совпадает с ценой деления</Label>
                    <Switch
                      checked={scene.grid.followAxisStep}
                      onCheckedChange={(checked) => updateGrid({ followAxisStep: checked })}
                    />
                  </div>
                  {!scene.grid.followAxisStep && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Шаг сетки по горизонтали</Label>
                        <Input
                          value={scene.grid.stepX}
                          placeholder="например pi/4"
                          className="font-mono"
                          onChange={(event) => updateGrid({ stepX: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Шаг сетки по вертикали</Label>
                        <Input
                          value={scene.grid.stepY}
                          placeholder="например 0.5"
                          className="font-mono"
                          onChange={(event) => updateGrid({ stepY: event.target.value })}
                        />
                      </div>
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
