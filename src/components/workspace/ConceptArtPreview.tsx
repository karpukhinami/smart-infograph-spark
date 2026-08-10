import type { ConceptArtJson, DesignProfile } from "@/lib/types";
import { ABSTRACTION_LEVEL_LABELS } from "@/lib/concept-art";
import { Markdown } from "@/components/workspace/Markdown";

interface Props {
  conceptArt: ConceptArtJson;
  profile: DesignProfile | null;
}

const FALLBACK = {
  backgroundColor: "#F5F6FF",
  surfaceColor: "#FFFFFF",
  primaryColor: "#4B5BD7",
  detailSoftColor: "#E7E9FB",
  headerColor: "#1A2236",
  lightTextColor: "#FFFFFF",
  mutedheaderTextColor: "#9399BD",
  inkColor: "#101828",
};

/** Read-only preview of the concept-art analysis: one card per visual interpretation. */
export function ConceptArtPreview({ conceptArt, profile }: Props) {
  const c = { ...FALLBACK, ...(profile?.colors ?? {}) };
  const meta = [conceptArt.subject, conceptArt.grade].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4" style={{ color: c.inkColor }}>
      <div
        className="rounded-xl px-4 py-3"
        style={{ background: c.headerColor, color: c.lightTextColor }}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: c.mutedheaderTextColor }}>
          {meta && <span>{meta}</span>}
          <span>
            Источник: {conceptArt.sourceMode === "topic" ? "тема" : "текст"}
          </span>
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-wide" style={{ color: c.mutedheaderTextColor }}>
          Центральная концепция
        </div>
        <div className="text-lg font-bold leading-tight">
          {conceptArt.centralConcept || "(не указана)"}
        </div>
        {conceptArt.abstractionLevel && (
          <div
            className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs"
            style={{ background: c.primaryColor, color: c.lightTextColor }}
          >
            {ABSTRACTION_LEVEL_LABELS[conceptArt.abstractionLevel]}
          </div>
        )}
      </div>

      {conceptArt.visualInterpretations.map((v, i) => (
        <div
          key={i}
          className="rounded-xl border p-3 space-y-3"
          style={{ background: c.surfaceColor, borderColor: c.detailSoftColor }}
        >
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: c.primaryColor, color: c.lightTextColor }}
            >
              {i + 1}
            </span>
            <div className="text-sm font-bold leading-snug">
              Тип визуальной интерпретации: {v.interpretationType}
            </div>
          </div>

          <div className="rounded-lg p-2.5" style={{ background: c.detailSoftColor }}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
              Идея и обоснование
            </div>
            <Markdown>{v.ideaAndRationale || "—"}</Markdown>
          </div>

          <div className="rounded-lg border p-2.5" style={{ borderColor: c.detailSoftColor }}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
              Описание изображения
            </div>
            <Markdown>{v.imageDescription || "—"}</Markdown>
          </div>
        </div>
      ))}

      {conceptArt.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="mb-1 font-semibold">Предупреждения анализа</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {conceptArt.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
