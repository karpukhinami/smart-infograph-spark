import type { AnalysisAttention, DesignProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const FALLBACK_COLORS = {
  primaryColor: "#FF8800",
  detailDeepColor: "#FFD4A3",
  contrastSoftColor: "#D9D4FF",
};

export const ATTENTION_COLOR_OPTIONS: {
  attention: AnalysisAttention;
  colorKey: keyof typeof FALLBACK_COLORS;
}[] = [
  { attention: "core", colorKey: "primaryColor" },
  { attention: "normal", colorKey: "detailDeepColor" },
  { attention: "accent", colorKey: "contrastSoftColor" },
];

const LAVENDER_RING = "ring-2 ring-[#A78BFA] ring-offset-1";

export function normalizeAttention(att: string | undefined): AnalysisAttention {
  const a = String(att ?? "normal").toLowerCase();
  if (a === "main") return "core";
  if (a === "core" || a === "accent") return a;
  return "normal";
}

export function attentionColor(
  attention: string | undefined,
  profile: DesignProfile | null,
): string {
  const c = { ...FALLBACK_COLORS, ...(profile?.colors ?? {}) };
  const att = normalizeAttention(attention);
  if (att === "core") return c.primaryColor;
  if (att === "accent") return c.contrastSoftColor;
  return c.detailDeepColor;
}

interface Props {
  value: AnalysisAttention;
  onChange: (value: AnalysisAttention) => void;
  profile: DesignProfile | null;
  size?: "sm" | "md";
  className?: string;
}

export function AttentionColorPicker({ value, onChange, profile, size = "md", className }: Props) {
  const c = { ...FALLBACK_COLORS, ...(profile?.colors ?? {}) };
  const normalized = normalizeAttention(value);
  const dotSize = size === "sm" ? "h-7 w-7" : "h-9 w-9";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {ATTENTION_COLOR_OPTIONS.map((opt) => (
        <button
          key={opt.attention}
          type="button"
          aria-label={`Цвет карточки: ${opt.attention}`}
          aria-pressed={normalized === opt.attention}
          className={cn(
            "inline-block shrink-0 rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dotSize,
            normalized === opt.attention && LAVENDER_RING,
          )}
          style={{ background: c[opt.colorKey] }}
          onClick={(e) => {
            e.stopPropagation();
            onChange(opt.attention);
          }}
        />
      ))}
    </div>
  );
}
