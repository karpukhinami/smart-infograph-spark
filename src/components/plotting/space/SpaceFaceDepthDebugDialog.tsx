import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SpaceFaceDepthReport } from "@/lib/plotting/space/space-face-depth-report";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: SpaceFaceDepthReport | null;
};

function fmtDepth(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(5);
}

export function SpaceFaceDepthDebugDialog({ open, onOpenChange, report }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Глубина граней (снимок)</DialogTitle>
          <DialogDescription>
            Зафиксировано при открытии. Меньше depthCentroid — ближе к наблюдателю. Для призмы —
            faceVisible и сплошные/пунктирные рёбра по текущей логике видимости.
          </DialogDescription>
        </DialogHeader>
        {!report ? (
          <p className="text-sm text-muted-foreground">Нет многогранника или не удалось построить сцену.</p>
        ) : (
          <div className="space-y-3 text-xs">
            <p className="text-muted-foreground">
              {report.capturedAt.slice(0, 19).replace("T", " ")} · yaw={Math.round(report.yaw)}° · режим глубины:{" "}
              {report.depthMode} · {report.figureKind}
            </p>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">Грань</th>
                  <th className="py-1 pr-2 font-medium">depth</th>
                  <th className="py-1 pr-2 font-medium">перед</th>
                  <th className="py-1 pr-2 font-medium">видима</th>
                  <th className="py-1 font-medium">рёбра</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.faceId} className="border-b border-border/60 align-top">
                    <td className="py-1.5 pr-2 font-mono">{row.label || row.faceId}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{fmtDepth(row.depthCentroid)}</td>
                    <td className="py-1.5 pr-2">{row.frontFacing ? "да" : "нет"}</td>
                    <td className="py-1.5 pr-2">
                      {row.faceVisible === null ? "—" : row.faceVisible ? "да" : "нет"}
                    </td>
                    <td className="py-1.5 tabular-nums">
                      {row.solidEdges}/{row.dashedEdges}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.some((r) => r.blockers.length > 0 || r.interiorOverlapWith.length > 0) && (
              <div className="space-y-2 border-t border-border pt-2">
                <p className="font-medium text-foreground">Перекрытия (внутренность проекции)</p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  {report.rows.map((row) =>
                    row.blockers.length ? (
                      <li key={row.faceId}>
                        <span className="font-mono text-foreground">{row.label}</span>: закрыта{" "}
                        {row.blockers.map((b) => (
                          <span key={b.otherFaceId} className="font-mono">
                            {b.otherLabel} (d={fmtDepth(b.depthOtherAtOverlap)} &lt; {fmtDepth(b.depthSelfAtOverlap)})
                          </span>
                        ))}
                      </li>
                    ) : row.interiorOverlapWith.length ? (
                      <li key={`${row.faceId}-ov`}>
                        <span className="font-mono text-foreground">{row.label}</span>: перекрытие с{" "}
                        {row.interiorOverlapWith.join(", ")} (не ближе)
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
