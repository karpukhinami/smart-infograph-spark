import { cn } from "@/lib/utils";
import type { BipolarFeedbackValue } from "@/lib/image-feedback-types";

const ACCENT = "#A78BFA";

interface Props {
  value: BipolarFeedbackValue;
  onChange: (value: "left" | "right") => void;
  ariaLabel: string;
}

export function BipolarSwitch({ value, onChange, ariaLabel }: Props) {
  const thumbPosition =
    value === "left" ? "left-0.5" : value === "right" ? "left-[calc(100%-1.25rem-0.125rem)]" : "left-1/2 -translate-x-1/2";

  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={value === "right" ? true : value === "left" ? false : undefined}
      className={cn(
        "relative h-7 w-14 shrink-0 rounded-full border transition-colors",
        value === "neutral"
          ? "border-border bg-muted/80"
          : "border-[#A78BFA]/50 bg-[#A78BFA]/15",
      )}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pickRight = x >= rect.width / 2;
        onChange(pickRight ? "right" : "left");
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange("left");
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange("right");
        }
      }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-5 rounded-full shadow-sm transition-all duration-200",
          value === "neutral" ? "bg-muted-foreground/35" : "bg-[#A78BFA]",
          thumbPosition,
        )}
      />
    </button>
  );
}

export function poleLabelClass(active: boolean) {
  return cn(
    "rounded-md px-2 py-1.5 text-xs leading-tight transition-colors cursor-pointer select-none text-center",
    active ? "font-medium text-[#6D28D9]" : "text-muted-foreground hover:text-foreground",
    active && "bg-[#A78BFA]/20",
  );
}

export { ACCENT as BIPOLAR_ACCENT };
