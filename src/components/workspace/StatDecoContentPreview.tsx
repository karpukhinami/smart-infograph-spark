import type { DesignProfile, StatDecoJson } from "@/lib/types";
import { Markdown } from "@/components/workspace/Markdown";
import { CHART_TYPE_LABELS } from "@/lib/stat-deco/render";
import { formatNum } from "@/lib/stat-deco/data";

interface Props {
  statDeco: StatDecoJson;
  profile?: DesignProfile | null;
}

function cellText(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  return typeof v === "number" ? formatNum(v) : String(v);
}

/** Контент-панель стиля «стат-деко»: данные таблицей + идеи оформления текстом. */
export function StatDecoContentPreview({ statDeco, profile = null }: Props) {
  const c = profile?.colors;
  const columns = statDeco.data.columns;
  const rowCount = columns.length ? Math.max(...columns.map((col) => col.length - 1)) : 0;
  const plan = statDeco.illustrationPlan;
  const meta = [statDeco.subject, statDeco.grade ? `${statDeco.grade} класс` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <header
        className="rounded-lg p-4"
        style={{ background: c?.headerColor ?? "#293642", color: c?.lightTextColor ?? "#fff" }}
      >
        <h3 className="text-base font-semibold">{statDeco.title || statDeco.topic}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs opacity-90">
          <span
            className="rounded-full px-2 py-0.5"
            style={{ background: c?.primaryColor ?? "#FFAA57", color: c?.inkColor ?? "#0C1126" }}
          >
            {CHART_TYPE_LABELS[statDeco.chartType]}
          </span>
          {meta && <span>{meta}</span>}
        </div>
        {statDeco.summary && <p className="mt-2 text-sm opacity-95">{statDeco.summary}</p>}
      </header>

      {!statDeco.dataStatus.canRender && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          Диаграмма не может быть построена: {statDeco.dataStatus.reason || "причина не указана"}
        </p>
      )}

      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Данные</h4>
        {rowCount > 0 ? (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: c?.detailSoftColor ?? "#F1F1F1" }}>
                  {columns.map((col, i) => (
                    <th key={i} className="border-b border-border px-3 py-2 text-left font-semibold">
                      {cellText(col[0])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }, (_, r) => (
                  <tr key={r} className="odd:bg-background even:bg-muted/40">
                    {columns.map((col, i) => (
                      <td key={i} className="border-b border-border px-3 py-1.5">
                        {cellText(col[r + 1])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Данных нет.</p>
        )}
      </section>

      {(plan.visualIntent || plan.overallTreatment || plan.elementInstructions.length > 0) && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Идеи оформления</h4>
          {plan.visualIntent && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">Замысел</p>
              <div className="text-sm"><Markdown>{plan.visualIntent}</Markdown></div>
            </div>
          )}
          {plan.overallTreatment && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">Общая обработка</p>
              <div className="text-sm"><Markdown>{plan.overallTreatment}</Markdown></div>
            </div>
          )}
          {plan.elementInstructions.length > 0 && (
            <div className="space-y-1.5">
              {plan.elementInstructions.map((e, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border p-3"
                  style={{ background: c?.surfaceColor ?? undefined }}
                >
                  <p className="text-xs font-semibold" style={{ color: c?.headerColor ?? undefined }}>
                    {e.target || "элемент"}
                  </p>
                  <div className="text-sm"><Markdown>{e.instruction}</Markdown></div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {statDeco.warnings.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-sm font-semibold">Замечания</h4>
          <ul className="list-disc pl-5 text-xs text-muted-foreground">
            {statDeco.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
