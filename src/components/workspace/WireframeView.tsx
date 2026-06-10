import type { WireframeBlock, WireframeDescription } from "@/lib/types";

const SIZE_UNITS: Record<string, number> = {
  full: 12,
  dominant: 8,
  wide: 8,
  half: 6,
  third: 4,
  quarter: 3,
  compact: 3,
  narrow: 3,
};

function blockUnits(b: WireframeBlock): number {
  if (typeof b.width === "number" && b.width > 0) return b.width;
  if (b.size && SIZE_UNITS[b.size]) return SIZE_UNITS[b.size];
  return 4;
}

function bgFill(role?: string): string {
  switch (role) {
    case "accent":
      return "color-mix(in oklab, var(--primary) 14%, transparent)";
    case "pastel":
      return "color-mix(in oklab, var(--primary) 6%, transparent)";
    case "structural-dark":
      return "color-mix(in oklab, var(--foreground) 12%, transparent)";
    case "warning":
      return "color-mix(in oklab, #f59e0b 16%, transparent)";
    default:
      return "transparent";
  }
}

function priorityStroke(p?: string): number {
  if (p === "high") return 2.2;
  if (p === "low") return 1;
  return 1.5;
}

function chips(b: WireframeBlock): string[] {
  const c: string[] = [];
  if (b.hasIcon) c.push("icon");
  if (b.hasFormula) c.push("formula");
  if (b.hasExample) c.push("example");
  if (b.hasVisual) c.push("visual");
  return c;
}

export function WireframeView({ wf }: { wf: WireframeDescription }) {
  const rowHeight = 120;
  const padding = 16;
  const gap = 10;
  const width = 760;
  const rows = wf.rows ?? [];
  const innerWidth = width - padding * 2;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 text-sm font-semibold">{wf.title || "Wireframe"}</div>
      {wf.mainVisual && (
        <div className="mb-2 text-xs text-muted-foreground">Main visual: {wf.mainVisual}</div>
      )}
      <svg
        viewBox={`0 0 ${width} ${rows.length * (rowHeight + gap) + padding * 2}`}
        className="w-full h-auto"
        style={{ color: "var(--wire, currentColor)" }}
      >
        {rows.map((row, ri) => {
          const totalUnits = row.blocks.reduce((a, b) => a + blockUnits(b), 0) || 1;
          let xCursor = padding;
          const y = padding + ri * (rowHeight + gap);
          return row.blocks.map((b, bi) => {
            const units = blockUnits(b);
            const w =
              (innerWidth * units) / totalUnits -
              (gap * (row.blocks.length - 1)) / row.blocks.length;
            const x = xCursor;
            xCursor += w + gap;
            const label = b.title || b.label || b.role || b.entityType || "block";
            const typeTag = b.role || b.entityType || b.type || "card";
            const meta = [
              b.sectionId != null ? `s${b.sectionId}` : null,
              b.priority ? `p:${b.priority}` : null,
              b.size ?? null,
            ]
              .filter(Boolean)
              .join(" · ");
            const cs = chips(b);
            return (
              <g key={`${ri}-${bi}`}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={rowHeight}
                  fill={bgFill(b.backgroundRole)}
                  stroke="currentColor"
                  strokeWidth={priorityStroke(b.priority)}
                  rx={8}
                />
                <text x={x + 10} y={y + 16} fontSize={10} fill="currentColor" opacity={0.6}>
                  [{typeTag}] {meta}
                </text>
                <text x={x + 10} y={y + 38} fontSize={13} fill="currentColor" fontWeight="700">
                  {label.length > 60 ? label.slice(0, 58) + "…" : label}
                </text>
                {b.contentPreview && (
                  <text x={x + 10} y={y + 58} fontSize={11} fill="currentColor" opacity={0.75}>
                    {b.contentPreview.length > 70
                      ? b.contentPreview.slice(0, 68) + "…"
                      : b.contentPreview}
                  </text>
                )}
                {cs.length > 0 &&
                  cs.map((tag, i) => (
                    <g key={tag}>
                      <rect
                        x={x + 10 + i * 64}
                        y={y + rowHeight - 24}
                        width={58}
                        height={16}
                        rx={4}
                        fill="none"
                        stroke="currentColor"
                        opacity={0.55}
                      />
                      <text
                        x={x + 10 + i * 64 + 29}
                        y={y + rowHeight - 12}
                        fontSize={9}
                        fill="currentColor"
                        textAnchor="middle"
                        opacity={0.75}
                      >
                        {tag}
                      </text>
                    </g>
                  ))}
                {b.note && (
                  <text
                    x={x + w - 10}
                    y={y + rowHeight - 8}
                    fontSize={9}
                    fill="currentColor"
                    opacity={0.55}
                    textAnchor="end"
                  >
                    {b.note.length > 40 ? b.note.slice(0, 38) + "…" : b.note}
                  </text>
                )}
              </g>
            );
          });
        })}
      </svg>
      {wf.connections && wf.connections.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          Connections: {wf.connections.map((c) => `${c.from} → ${c.to}`).join("; ")}
        </div>
      )}
    </div>
  );
}
