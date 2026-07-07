import { useMemo } from "react";
import type { AnalysisJson, DesignProfile } from "@/lib/types";
import { buildA4AutoLayout, buildA4ManualLayout } from "@/lib/a4-layout";
import type { A4DomFitOptions } from "@/lib/a4-layout/types";
import { A4LayoutCanvas } from "@/components/workspace/A4LayoutCanvas";

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
}

export function A4AutoLayoutView({ analysis, active, profile = null, manualApply = null }: Props) {
  const layout = useMemo(() => {
    if (!manualApply) return buildA4AutoLayout(analysis);
    const domFitOptions: A4DomFitOptions = {
      balanceRowFonts: manualApply.balanceRowFonts,
      allowAddendumRight: manualApply.allowAddendumRight,
    };
    return buildA4ManualLayout(analysis, manualApply.template, domFitOptions);
  }, [analysis, manualApply]);

  const modeNote = !manualApply
    ? "Автоматический расчёт рядов"
    : layout.manualUsedAutoRatios
      ? "Ручной режим (ряды как в авто)"
      : "Ручной шаблон рядов";

  return (
    <A4LayoutCanvas
      layout={layout}
      active={active}
      profile={profile}
      modeNote={modeNote}
      modeNoteClassName={manualApply ? "a4-layout-mode-note" : "a4-layout-mode-note a4-layout-mode-note-auto"}
      manualErrors={layout.manualErrors}
    />
  );
}
