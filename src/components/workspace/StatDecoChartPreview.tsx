import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DesignProfile, StatDecoJson } from "@/lib/types";
import { buildStatDecoOption } from "@/lib/stat-deco/echarts-option";
import { setStatDecoChartPng } from "@/lib/stat-deco/chart-image";
import { downloadLayoutPng } from "@/lib/download-infographic";

interface EchartsLike {
  setOption: (option: unknown, notMerge: boolean) => void;
  resize: () => void;
  dispose: () => void;
  getDataURL: (opts: { type: string; pixelRatio: number; backgroundColor?: string }) => string;
}

interface Props {
  statDeco: StatDecoJson;
  profile?: DesignProfile | null;
  active: boolean;
}

/**
 * Programmatic reference chart for the "стат-деко" style.
 * ECharts is loaded lazily (browser-only) and rendered on a canvas, so the
 * result can be exported as a PNG data URL both for the user and for the
 * drawing model.
 */
export function StatDecoChartPreview({ statDeco, profile = null, active }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EchartsLike | null>(null);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { option, error } = useMemo(
    () => buildStatDecoOption(statDeco, profile),
    [statDeco, profile],
  );

  useEffect(() => {
    if (!active || error) return;
    let disposed = false;
    let chart: EchartsLike | null = null;

    (async () => {
      const echarts = await import("echarts");
      if (disposed || !hostRef.current) return;
      chart = echarts.init(hostRef.current, undefined, {
        renderer: "canvas",
        devicePixelRatio: 2,
      }) as unknown as EchartsLike;
      chartRef.current = chart;
      chart?.setOption(option, true);
      setReady(true);
    })().catch((e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Не удалось построить диаграмму");
    });

    const onResize = () => chart?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      chart?.dispose();
      chartRef.current = null;
      setReady(false);
    };
  }, [active, option, error]);

  // Keep the latest rendered chart available for the design-brief / drawing step.
  useEffect(() => {
    if (!ready || !chartRef.current) return;
    try {
      const dataUrl: string = chartRef.current.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: option.backgroundColor as string | undefined,
      });
      setStatDecoChartPng(dataUrl);
    } catch {
      setStatDecoChartPng(null);
    }
  }, [ready, option]);

  function onSavePng() {
    if (!chartRef.current) return;
    try {
      setExporting(true);
      const dataUrl: string = chartRef.current.getDataURL({
        type: "png",
        pixelRatio: 3,
        backgroundColor: option.backgroundColor as string | undefined,
      });
      setStatDecoChartPng(dataUrl);
      downloadLayoutPng(dataUrl, "диаграмма", statDeco.title || statDeco.topic);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить PNG");
    } finally {
      setExporting(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
        Диаграмму построить не удалось: {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onSavePng} disabled={!ready || exporting}>
          {exporting ? (
            <Loader2 className="size-3.5 mr-1 animate-spin" />
          ) : (
            <Download className="size-3.5 mr-1" />
          )}
          Сохранить PNG
        </Button>
      </div>
      <div className="rounded-md border border-border bg-background p-2">
        <div ref={hostRef} className="h-[520px] w-full" />
      </div>
      {!statDeco.dataStatus.canRender && (
        <p className="text-xs text-destructive">
          Модель отметила, что данных недостаточно: {statDeco.dataStatus.reason || "причина не указана"}
        </p>
      )}
    </div>
  );
}
