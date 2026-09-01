import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {PLOT_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "flex size-6 items-center justify-center rounded-full border border-border transition",
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
        {/* Седьмой кружок — текущий цвет объекта (не добавляет новые кружки). */}
        <span
          title="Текущий цвет"
          style={{ backgroundColor: value }}
          className="flex size-6 items-center justify-center rounded-full border-2 border-foreground/40"
        >
          <Check className="size-3.5 text-white drop-shadow" />
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-6 bg-background"
              aria-label="Больше цветов"
            >
              <Plus className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-3">
            <div className="space-y-2">
              {PLOT_PALETTE_GROUPS.map((group) => (
                <div key={group.name} className="flex items-center gap-1.5">
                  {group.colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onChange(color)}
                      style={{ backgroundColor: color }}
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md border border-border transition",
                        value.toLowerCase() === color.toLowerCase() &&
                          "ring-2 ring-ring ring-offset-1 ring-offset-background",
                      )}
                      aria-label={`${group.name} ${color}`}
                    >
                      {value.toLowerCase() === color.toLowerCase() && (
                        <Check className="size-3.5 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              ))}
              {/* Свои цвета и пустой квадратик под новый. */}
              <div className="flex flex-wrap items-center gap-1.5">
                {customColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onChange(color)}
                    style={{ backgroundColor: color }}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-md border border-border transition",
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
                <span className="size-6 rounded-md border border-dashed border-border bg-white" />
              </div>
            </div>

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
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
