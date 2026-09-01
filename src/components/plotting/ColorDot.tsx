import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorSwatches } from "./ColorSwatches";
import { usePlotStore } from "@/lib/plotting/store";
import { cn } from "@/lib/utils";

/** Кружок цвета в заголовке: по щелчку разворачивается палитра. */
export function ColorDot({
  value,
  onChange,
  className,
  title = "Цвет",
}: {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  title?: string;
}) {
  const customColors = usePlotStore((state) => state.scene.customColors);
  const addCustomColor = usePlotStore((state) => state.addCustomColor);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={title}
          title={title}
          style={{ backgroundColor: value }}
          className={cn(
            "size-6 shrink-0 rounded-full border-2 border-border shadow-sm transition hover:scale-110",
            className,
          )}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <ColorSwatches
          value={value}
          onChange={onChange}
          customColors={customColors}
          onAddCustomColor={addCustomColor}
          label={title}
        />
      </PopoverContent>
    </Popover>
  );
}
