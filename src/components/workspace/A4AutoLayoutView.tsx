import { forwardRef, useMemo } from "react";
import type { AnalysisJson, DesignProfile } from "@/lib/types";
import { buildA4AutoLayout, buildA4ManualLayout } from "@/lib/a4-layout";
import type { A4DomFitOptions } from "@/lib/a4-layout/types";
import { DEFAULT_A4_DOM_FIT_OPTIONS } from "@/lib/a4-layout/types";
import { A4LayoutCanvas, type A4LayoutCanvasHandle } from "@/components/workspace/A4LayoutCanvas";
import { getActiveContentVersion } from "@/store/useProjectStore";

export interface ManualLayoutApply {
  template: string;
}

interface Props {
  analysis: AnalysisJson;
  active: boolean;
  profile?: DesignProfile | null;
  /** When set, auto-layout tab shows manual preview (template may be empty = auto row ratios). */
  manualApply?: ManualLayoutApply | null;
  domFitOptions?: A4DomFitOptions;
  accentHighlightText?: boolean;
}

export const A4AutoLayoutView = forwardRef<A4LayoutCanvasHandle, Props>(function A4AutoLayoutView(
  {
    analysis,
    active,
    profile = null,
    manualApply = null,
    domFitOptions = DEFAULT_A4_DOM_FIT_OPTIONS,
    accentHighlightText = true,
  },
  ref,
) {
  const layout = useMemo(() => {
    const currentAnalysis = getActiveContentVersion()?.value.analysis ?? analysis;
    const base = manualApply
      ? buildA4ManualLayout(currentAnalysis, manualApply.template, domFitOptions)
      : buildA4AutoLayout(currentAnalysis, domFitOptions);
    return { ...base, domFitOptions };
  }, [analysis, manualApply, domFitOptions]);

  const modeNote = manualApply
    ? layout.manualUsedAutoRatios
      ? "Ручной режим (ряды как в авто)"
      : "Ручной шаблон рядов"
    : undefined;

  return (
    <A4LayoutCanvas
      ref={ref}
      layout={layout}
      active={active}
      profile={profile}
      modeNote={modeNote}
      modeNoteClassName="a4-layout-mode-note"
      manualErrors={layout.manualErrors}
      exportKind="авто-макет"
      accentHighlightText={accentHighlightText}
    />
  );
});
