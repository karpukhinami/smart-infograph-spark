import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLOT_PALETTE, PLOT_PALETTE_GROUPS } from "@/lib/plotting/scene";
import { cn } from "@/lib/utils";

interface ColorSwatchesProps {
  value: string;
  onChange: (color: string) => void;
  customColors: string[];
  onAddCustomColor: (color: string) => void;
  label?: string;
}

export function ColorSwatches({
  value,
  onChange,
  customColors,
  onAddCustomColor,
  label = "Цвет",
}: ColorSwatchesProps) {
  const [draft, setDraft] = useState(value || "#29A2E5");

  const allColors = PLOT_PALETTE_GROUPS.flatMap((group) => group.colors);

  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>

      {/* Основной ряд: 6 фирменных цветов + текущий цвет объекта. */}
      <div className="grid grid-cols-6 gap-1.5">
        {PLOT_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "flex size-6 items-center justify-center rounded-[3px] border border-border transition",
              value.toLowerCase() === color.toLowerCase() &&
                "ring-2 ring-ring ring-offset-1 ring-offset-background",
            )}
            aria-label={`Цвет ${color}`}
          >
            {value.toLowerCase() === color.toLowerCase() && (
              <Check className="size-3.5 text-white drop-shadow" />
            )}
          </button>
        ))}
        {/* Седьмой квадратик — текущий цвет объекта (не добавляет новые). */}
        <span
          title="Текущий цвет"
          style={{ backgroundColor: value }}
          className="flex size-6 items-center justify-center rounded-[3px] border-2 border-foreground/40"
        >
          <Check className="size-3.5 text-white drop-shadow" />
        </span>
      </div>

      {/* Полная фирменная палитра квадратиками по 6 в ряд. */}
      <div className="grid grid-cols-6 gap-1.5">
        {allColors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "flex size-6 items-center justify-center rounded-[3px] border border-border transition",
              value.toLowerCase() === color.toLowerCase() &&
                "ring-2 ring-ring ring-offset-1 ring-offset-background",
            )}
            aria-label={`Цвет ${color}`}
          >
            {value.toLowerCase() === color.toLowerCase() && (
              <Check className="size-3.5 text-white drop-shadow" />
            )}
          </button>
        ))}
        {/* Свои цвета + пустой квадратик под новый. */}
        {customColors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "flex size-6 items-center justify-center rounded-[3px] border border-border transition",
              value.toLowerCase() === color.toLowerCase() &&
                "ring-2 ring-ring ring-offset-1 ring-offset-background",
            )}
            aria-label={`Свой цвет ${color}`}
          >
            {value.toLowerCase() === color.toLowerCase() && (
              <Check className="size-3.5 text-white drop-shadow" />
            )}
          </button>
        ))}
        <span className="size-6 rounded-[3px] border border-dashed border-border bg-white" />
      </div>

      {/* Сразу открытая палитра выбора своего цвета. */}
      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs text-muted-foreground">Свой цвет</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-9 w-16 cursor-pointer rounded-md border border-border bg-background"
          />
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() => {
            const color = draft.trim();
            if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
            onAddCustomColor(color);
            onChange(color);
          }}
        >
          Добавить
        </Button>
      </div>
    </div>
  );
}
