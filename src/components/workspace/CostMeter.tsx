import { useState } from "react";
import { useUsageStore } from "@/store/useUsageStore";
import { fmtUsd } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, X } from "lucide-react";

export function CostMeter() {
  const history = useUsageStore((s) => s.history);
  const reset = useUsageStore((s) => s.reset);
  const [open, setOpen] = useState(false);

  const total = history.reduce(
    (acc, r) => {
      acc.cost += r.costUsd;
      acc.tokens += r.totalTokens;
      return acc;
    },
    { cost: 0, tokens: 0 },
  );
  const last = history[history.length - 1];

  return (
    <div className="fixed bottom-3 right-3 z-50 rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 w-full"
        title="Расход токенов и стоимость запросов"
      >
        <span className="font-mono font-semibold">{fmtUsd(total.cost)}</span>
        <span className="text-muted-foreground">
          {total.tokens.toLocaleString("ru")} ток · {history.length} зап
        </span>
        {open ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
      </button>
      {open && (
        <div className="border-t border-border p-2 space-y-1 max-h-80 overflow-auto min-w-[300px]">
          {last && (
            <div className="mb-2 rounded bg-muted/40 p-2">
              <div className="font-semibold">Последний запрос</div>
              <div className="font-mono">
                {last.model} · {last.kind}
              </div>
              <div>
                in {last.inputTokens.toLocaleString("ru")} / out{" "}
                {last.outputTokens.toLocaleString("ru")} · {fmtUsd(last.costUsd)}
              </div>
            </div>
          )}
          {history.length === 0 && (
            <div className="text-muted-foreground">Запросов пока нет.</div>
          )}
          {[...history]
            .slice(-15)
            .reverse()
            .map((r, i) => (
              <div key={i} className="flex justify-between gap-3 font-mono">
                <span className="truncate">{r.model.split("/").pop()}</span>
                <span className="text-muted-foreground shrink-0">
                  {r.totalTokens.toLocaleString("ru")}т · {fmtUsd(r.costUsd)}
                </span>
              </div>
            ))}
          {history.length > 0 && (
            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="ghost" onClick={reset} className="h-6 px-2 text-xs">
                <X className="size-3 mr-1" /> Очистить
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
