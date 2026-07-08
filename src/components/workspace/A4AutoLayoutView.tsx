import { forwardRef, useMemo } from "react";
import type { AnalysisJson, DesignProfile } from "@/lib/types";
import { buildA4AutoLayout, buildA4ManualLayout } from "@/lib/a4-layout";
import type { A4DomFitOptions } from "@/lib/a4-layout/types";
import { A4LayoutCanvas, type A4LayoutCanvasHandle } from "@/components/workspace/A4LayoutCanvas";
import { getActiveContentVersion } from "@/store/useProjectStore";

export interface ManualLayoutApply {
  template: string;
  balanceRowFonts: boolean;
  allowAddendumRight: boolean;
}

interface Props {
  analysis: AnalysisJson;
  active: boolean;
  profile?: DesignProfile | null;
  /** When set, auto-layout tab shows manual preview (template may be empty = auto row ratios). */
  manualApply?: ManualLayoutApply | null;
  accentHighlightText?: boolean;
}

export const A4AutoLayoutView = forwardRef<A4LayoutCanvasHandle, Props>(function A4AutoLayoutView(
  { analysis, active, profile = null, manualApply = null, accentHighlightText = true },
  ref,
) {
  const layout = useMemo(() => {
    const currentAnalysis = getActiveContentVersion()?.value.analysis ?? analysis;
    if (!manualApply) return buildA4AutoLayout(currentAnalysis);
    const domFitOptions: A4DomFitOptions = {
      balanceRowFonts: manualApply.balanceRowFonts,
      allowAddendumRight: manualApply.allowAddendumRight,
    };
    return buildA4ManualLayout(currentAnalysis, manualApply.template, domFitOptions);
  }, [analysis, manualApply]);

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
