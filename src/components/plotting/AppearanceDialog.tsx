import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { usePlotStore } from "@/lib/plotting/store";
import type { PlotAppearance } from "@/lib/plotting/types";

const NUMBER_FIELDS: Array<{ key: keyof PlotAppearance; label: string; step?: number }> = [
  { key: "width", label: "Ширина изображения" },
  { key: "height", label: "Высота изображения" },
  { key: "padding", label: "Внутренние отступы" },
  { key: "axisWidth", label: "Толщина осей", step: 0.1 },
  { key: "arrowSize", label: "Размер стрелок" },
  { key: "gridWidth", label: "Толщина сетки", step: 0.1 },
  { key: "frameWidth", label: "Толщина рамки", step: 0.1 },
  { key: "tickWidth", label: "Толщина засечек", step: 0.1 },
  { key: "tickSize", label: "Размер засечек" },
  { key: "labelFontSize", label: "Размер подписей шкалы" },
  { key: "graphWidth", label: "Толщина линий графиков", step: 0.1 },
  { key: "pointRadius", label: "Размер точек", step: 0.5 },
  { key: "pointLabelFontSize", label: "Размер подписей точек" },
  { key: "projectionWidth", label: "Толщина перпендикуляров", step: 0.1 },
];

const COLOR_FIELDS: Array<{ key: keyof PlotAppearance; label: string }> = [
  { key: "axisColor", label: "Цвет осей" },
  { key: "gridColor", label: "Цвет сетки" },
  { key: "frameColor", label: "Цвет рамки" },
  { key: "labelColor", label: "Цвет подписей" },
  { key: "projectionColor", label: "Цвет перпендикуляров" },
];

export function AppearanceDialog() {
  const appearance = usePlotStore((state) => state.scene.appearance);
  const updateAppearance = usePlotStore((state) => state.updateAppearance);
  const resetAppearance = usePlotStore((state) => state.resetAppearance);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Settings2 className="size-4" />
          Настройки
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Оформление чертежа</DialogTitle>
          <DialogDescription>
            Только внешний вид: размеры, толщины, цвета и шрифты. Смысловые настройки шкалы находятся
            в разделе «Оси и сетка».
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {NUMBER_FIELDS.map((field) => (
            <div key={String(field.key)} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{field.label}</Label>
              <Input
                type="number"
                step={field.step ?? 1}
                value={String(appearance[field.key] as number)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) updateAppearance({ [field.key]: value } as Partial<PlotAppearance>);
                }}
              />
            </div>
          ))}
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          {COLOR_FIELDS.map((field) => (
            <div key={String(field.key)} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{field.label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={String(appearance[field.key])}
                  onChange={(event) =>
                    updateAppearance({ [field.key]: event.target.value } as Partial<PlotAppearance>)
                  }
                  className="size-9 cursor-pointer rounded-md border border-border bg-background"
                />
                <Input
                  value={String(appearance[field.key])}
                  onChange={(event) =>
                    updateAppearance({ [field.key]: event.target.value } as Partial<PlotAppearance>)
                  }
                  className="font-mono text-xs"
                />
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="grid gap-3">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label className="text-sm">Рамка вокруг чертежа</Label>
            <Switch
              checked={appearance.frame}
              onCheckedChange={(checked) => updateAppearance({ frame: checked })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Шрифт подписей шкалы</Label>
            <Input
              value={appearance.labelFontFamily}
              onChange={(event) => updateAppearance({ labelFontFamily: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Шрифт подписей точек</Label>
            <Input
              value={appearance.pointLabelFontFamily}
              onChange={(event) => updateAppearance({ pointLabelFontFamily: event.target.value })}
            />
          </div>
        </div>

        <Button type="button" variant="outline" onClick={resetAppearance}>
          Вернуть значения по умолчанию
        </Button>
      </DialogContent>
    </Dialog>
  );
}
