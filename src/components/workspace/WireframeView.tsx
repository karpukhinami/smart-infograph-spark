import type { WireframeDescription } from "@/lib/types";

export function WireframeView({ wf }: { wf: WireframeDescription }) {
  const rowHeight = 90;
  const padding = 16;
  const gap = 10;
  const width = 720;
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
        style={{ color: "var(--wire)" }}
      >
        {rows.map((row, ri) => {
          const totalUnits = row.blocks.reduce((a, b) => a + (b.width || 1), 0) || 1;
          let xCursor = padding;
          const y = padding + ri * (rowHeight + gap);
          return row.blocks.map((b, bi) => {
            const w = (innerWidth * (b.width || 1)) / totalUnits - gap * (row.blocks.length - 1) / row.blocks.length;
            const x = xCursor;
            xCursor += w + gap;
            return (
              <g key={`${ri}-${bi}`}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={rowHeight}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  rx={6}
                />
                <text
                  x={x + 8}
                  y={y + 18}
                  fontSize={11}
                  fill="currentColor"
                  opacity={0.6}
                >
                  [{b.type}]
                </text>
                <text x={x + 8} y={y + 38} fontSize={13} fill="currentColor" fontWeight="600">
                  {b.label}
                </text>
                {b.note && (
                  <text x={x + 8} y={y + 56} fontSize={10} fill="currentColor" opacity={0.6}>
                    {b.note}
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
