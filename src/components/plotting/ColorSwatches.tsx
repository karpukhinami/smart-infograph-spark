import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLOT_PALETTE } from "@/lib/plotting/scene";
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
  const [draft, setDraft] = useState("#19ADFF");
  const colors = [...PLOT_PALETTE, ...customColors.filter((color) => !PLOT_PALETTE.includes(color))];

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "flex size-6 items-center justify-center rounded-md border border-border transition",
              value === color && "ring-2 ring-ring ring-offset-1 ring-offset-background",
            )}
            aria-label={`Цвет ${color}`}
          >
            {value === color && <Check className="size-3.5 text-white drop-shadow" />}
          </button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-6 bg-background"
              aria-label="Свой цвет"
            >
              <Plus className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 space-y-3">
            <Label className="text-xs text-muted-foreground">Свой цвет</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="size-9 cursor-pointer rounded-md border border-border bg-background"
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
              Использовать
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
