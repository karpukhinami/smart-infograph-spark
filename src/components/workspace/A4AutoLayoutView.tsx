import { useMemo } from "react";
import type { AnalysisJson } from "@/lib/types";
import { buildA4AutoLayout, buildA4ManualLayout } from "@/lib/a4-layout";
import { A4LayoutCanvas } from "@/components/workspace/A4LayoutCanvas";

interface Props {
  analysis: AnalysisJson;
  active: boolean;
  manualTemplate?: string | null;
}

export function A4AutoLayoutView({ analysis, active, manualTemplate = null }: Props) {
  const layout = useMemo(() => {
    const trimmed = manualTemplate?.trim();
    if (trimmed) return buildA4ManualLayout(analysis, trimmed);
    return buildA4AutoLayout(analysis);
  }, [analysis, manualTemplate]);

  const isManual = Boolean(manualTemplate?.trim());

  return (
    <A4LayoutCanvas
      layout={layout}
      active={active}
      modeNote={isManual ? "Ручной шаблон рядов" : "Автоматический расчёт рядов"}
      modeNoteClassName={isManual ? "a4-layout-mode-note" : "a4-layout-mode-note a4-layout-mode-note-auto"}
      manualErrors={layout.manualErrors}
    />
  );
}
