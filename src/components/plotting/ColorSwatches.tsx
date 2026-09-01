import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
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

function normalizeHex(color: string): string {
  return color.trim().toLowerCase();
}

function isBaseColor(color: string): boolean {
  return PLOT_PALETTE.some((item) => item.toLowerCase() === normalizeHex(color));
}

function isValidHex(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color.trim());
}

function CircleSwatch({
  color,
  selected,
  onClick,
  title,
}: {
  color: string;
  selected: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{ backgroundColor: color }}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-border transition hover:scale-105",
        selected && "ring-2 ring-ring ring-offset-1 ring-offset-background",
        !onClick && "cursor-default",
      )}
      aria-label={title ?? `Цвет ${color}`}
      disabled={!onClick}
    >
      {selected && <Check className="size-3.5 text-white drop-shadow" />}
    </button>
  );
}

export function ColorSwatches({
  value,
  onChange,
  customColors,
  onAddCustomColor,
  label = "Цвет",
}: ColorSwatchesProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(value || "#29A2E5");

  useEffect(() => {
    setDraft(value || "#29A2E5");
  }, [value]);

  const allColors = PLOT_PALETTE_GROUPS.flatMap((group) => group.colors);
  const showCustomSlot = value && !isBaseColor(value);

  const applyCustomColor = (color: string) => {
    const trimmed = color.trim();
    if (!isValidHex(trimmed)) return;
    onAddCustomColor(trimmed);
    onChange(trimmed);
    setDraft(trimmed);
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>

      {/* Компактный ряд: 6 базовых + (7-й, если не базовый) + плюс. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PLOT_PALETTE.map((color) => (
          <CircleSwatch
            key={color}
            color={color}
            selected={normalizeHex(value) === normalizeHex(color)}
            onClick={() => onChange(color)}
            title={`Цвет ${color}`}
          />
        ))}
        {showCustomSlot && (
          <CircleSwatch
            color={value}
            selected
            onClick={() => onChange(value)}
            title="Текущий цвет"
          />
        )}
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border bg-background transition hover:scale-105 hover:bg-muted",
            expanded && "border-solid bg-muted",
          )}
          aria-label={expanded ? "Свернуть палитру" : "Развернуть палитру"}
          title={expanded ? "Свернуть" : "Ещё цвета"}
        >
          <Plus className={cn("size-3.5 text-muted-foreground transition", expanded && "rotate-45")} />
        </button>
      </div>

      {expanded && (
        <>
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
                  normalizeHex(value) === normalizeHex(color) &&
                    "ring-2 ring-ring ring-offset-1 ring-offset-background",
                )}
                aria-label={`Цвет ${color}`}
              >
                {normalizeHex(value) === normalizeHex(color) && (
                  <Check className="size-3.5 text-white drop-shadow" />
                )}
              </button>
            ))}
            {customColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onChange(color)}
                style={{ backgroundColor: color }}
                className={cn(
                  "flex size-6 items-center justify-center rounded-[3px] border border-border transition",
                  normalizeHex(value) === normalizeHex(color) &&
                    "ring-2 ring-ring ring-offset-1 ring-offset-background",
                )}
                aria-label={`Свой цвет ${color}`}
              >
                {normalizeHex(value) === normalizeHex(color) && (
                  <Check className="size-3.5 text-white drop-shadow" />
                )}
              </button>
            ))}
            <span className="size-6 rounded-[3px] border border-dashed border-border bg-white" />
          </div>

          {/* Всегда открытая палитра своего цвета. */}
          <div className="space-y-2 border-t border-border pt-3">
            <Label className="text-xs text-muted-foreground">Свой цвет</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft}
                onChange={(event) => applyCustomColor(event.target.value)}
                className="h-9 w-16 cursor-pointer rounded-md border border-border bg-background"
              />
              <Input
                value={draft}
                onChange={(event) => {
                  const next = event.target.value;
                  setDraft(next);
                  if (isValidHex(next)) applyCustomColor(next);
                }}
                className="font-mono text-xs"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
