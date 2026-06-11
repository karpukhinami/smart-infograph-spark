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
  const rowHeight = 170;
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
                <foreignObject x={x + 10} y={y + 8} width={Math.max(20, w - 20)} height={rowHeight - 16}>
                  <div
                    style={{
                      fontFamily: "inherit",
                      color: "currentColor",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      height: "100%",
                      overflow: "hidden",
                    }}
                    xmlns="http://www.w3.org/1999/xhtml"
                  >
                    <div style={{ fontSize: 10, opacity: 0.55, lineHeight: 1.1 }}>
                      [{typeTag}] {meta}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.15, wordBreak: "break-word" }}>
                      {label}
                    </div>
                    {b.contentPreview && (
                      <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.25, wordBreak: "break-word" }}>
                        {b.contentPreview}
                      </div>
                    )}
                    <div style={{ marginTop: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {cs.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 4,
                            border: "1px solid currentColor",
                            opacity: 0.7,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      {b.note && (
                        <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.55 }}>{b.note}</span>
                      )}
                    </div>
                  </div>
                </foreignObject>
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
