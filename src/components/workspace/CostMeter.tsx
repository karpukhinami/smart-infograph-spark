import { useState } from "react";
import { useUsageStore } from "@/store/useUsageStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { fmtUsd } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, X, FileText } from "lucide-react";

export function CostMeter() {
  const history = useUsageStore((s) => s.history);
  const rawHistory = useUsageStore((s) => s.rawHistory);
  const reset = useUsageStore((s) => s.reset);
  const uiMode = useSettingsStore((s) => s.uiMode);
  const allowExpand = uiMode === "debug";
  const [openState, setOpenState] = useState(false);
  const open = allowExpand && openState;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => {
    if (!allowExpand) return;
    setOpenState((prev) => (typeof v === "function" ? v(prev) : v));
  };
  const [tab, setTab] = useState<"cost" | "raw">("cost");
  const [rawIdx, setRawIdx] = useState<number | null>(null);

  const total = history.reduce(
    (acc, r) => {
      acc.cost += r.costUsd;
      acc.tokens += r.totalTokens;
      return acc;
    },
    { cost: 0, tokens: 0 },
  );
  const last = history[history.length - 1];
  const selectedRaw = rawIdx != null ? rawHistory[rawIdx] : rawHistory[rawHistory.length - 1];

  return (
    <div className="relative rounded-lg border border-border bg-card/95 shadow-sm backdrop-blur text-xs max-w-[min(96vw,640px)]">
      <div className="flex items-center gap-1 pr-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex flex-1 items-center gap-2 px-3 py-1.5 min-w-0"
        title="Расход токенов и стоимость запросов"
      >
        <span className="font-mono font-semibold">{fmtUsd(total.cost)}</span>
        <span className="text-muted-foreground">
          {total.tokens.toLocaleString("ru")} ток · {history.length} зап
        </span>
        {allowExpand && rawHistory.length > 0 && (
          <span className="ml-1 text-muted-foreground inline-flex items-center gap-1">
            <FileText className="size-3" /> {rawHistory.length}
          </span>
        )}
        {allowExpand && (open ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />)}
      </button>
      {(history.length > 0 || rawHistory.length > 0) && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 shrink-0 text-muted-foreground hover:text-foreground"
          title="Очистить историю расходов и сырые ответы"
          onClick={() => reset()}
        >
          <X className="size-3.5" />
        </Button>
      )}
      </div>
      {open && (
        <div className="border-t border-border">
          <div className="flex border-b border-border">
            <button
              type="button"
              className={`flex-1 px-3 py-1.5 ${tab === "cost" ? "bg-muted/50 font-semibold" : ""}`}
              onClick={() => setTab("cost")}
            >
              Стоимость
            </button>
            <button
              type="button"
              className={`flex-1 px-3 py-1.5 ${tab === "raw" ? "bg-muted/50 font-semibold" : ""}`}
              onClick={() => setTab("raw")}
            >
              Сырые ответы ({rawHistory.length})
            </button>
          </div>

          {tab === "cost" && (
            <div className="p-2 space-y-1 max-h-80 overflow-auto min-w-[300px]">
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

          {tab === "raw" && (
            <div className="p-2 min-w-[320px] w-[min(92vw,640px)]">
              {rawHistory.length === 0 ? (
                <div className="text-muted-foreground">Сырых ответов пока нет.</div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1 mb-2 max-h-20 overflow-auto">
                    {rawHistory.map((r, i) => {
                      const active = (rawIdx ?? rawHistory.length - 1) === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setRawIdx(i)}
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${active ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                          title={`${r.model} · ${new Date(r.at).toLocaleTimeString("ru")}`}
                        >
                          #{i + 1} {r.kind === "image" ? "🖼" : "📝"} {r.model.split("/").pop()?.slice(0, 14)}
                        </button>
                      );
                    })}
                  </div>
                  {selectedRaw && (
                    <>
                      <div className="text-[10px] text-muted-foreground mb-1 font-mono">
                        {selectedRaw.model} · {selectedRaw.kind} ·{" "}
                        {selectedRaw.note ?? ""} ·{" "}
                        {new Date(selectedRaw.at).toLocaleTimeString("ru")}
                      </div>
                      <pre className="bg-muted/40 rounded p-2 max-h-72 overflow-auto text-[10px] leading-snug whitespace-pre-wrap break-all">
                        {selectedRaw.raw}
                      </pre>
                      <div className="pt-2 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => reset()}
                        >
                          <X className="size-3 mr-1" /> Очистить всё
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            void navigator.clipboard.writeText(selectedRaw.raw);
                          }}
                        >
                          Копировать
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
