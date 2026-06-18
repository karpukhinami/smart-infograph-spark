import type { CSSProperties } from "react";
import type { AnalysisEntity, AnalysisGroupItem, AnalysisJson, DesignProfile } from "@/lib/types";

interface Props {
  analysis: AnalysisJson;
  profile: DesignProfile | null;
}

function asLines(v: string | string[] | null | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v.filter((s) => s != null && String(s).trim() !== "").map(String) : [String(v)];
}

const FALLBACK = {
  backgroundColor: "#F5F6FF",
  surfaceColor: "#FFFFFF",
  primaryColor: "#FF8800",
  detailSoftColor: "#FFE3C2",
  detailDeepColor: "#FFD4A3",
  contrastSoftColor: "#D9D4FF",
  inkColor: "#101828",
  headerColor: "#1A2236",
  lightTextColor: "#FFFFFF",
  spotAccentColor: "#F074FF",
  mutedheaderTextColor: "#9399BD",
};

export function SimpleContentPreview({ analysis, profile }: Props) {
  const c = { ...FALLBACK, ...(profile?.colors ?? {}) };
  const entities = analysis.entities ?? [];

  // Assign alternating pastel index to "normal" entities only.
  let normalRun = 0;
  const items = entities.map((e) => {
    const att = e.attention ?? "normal";
    let bg = c.detailSoftColor;
    let onBg = c.inkColor;
    if (att === "core") {
      bg = c.primaryColor;
      onBg = c.inkColor;
    } else if (att === "accent") {
      bg = c.contrastSoftColor;
      onBg = c.inkColor;
    } else {
      bg = normalRun % 2 === 0 ? c.detailSoftColor : c.detailDeepColor;
      normalRun++;
    }
    return { e, bg, onBg };
  });

  const titleParts = [analysis.subject, analysis.grade].filter(Boolean).join(" · ");

  return (
    <div className="space-y-3" style={{ color: c.inkColor }}>
      {/* Header card */}
      <div className="rounded-xl px-4 py-3" style={{ background: c.headerColor, color: c.lightTextColor }}>
        {(analysis.subject || analysis.grade) && (
          <div className="flex items-center gap-2 text-xs" style={{ color: c.mutedheaderTextColor }}>
            {analysis.subject && <span>{analysis.subject}</span>}
            {analysis.subject && analysis.grade && (
              <span className="inline-block size-1.5 rounded-full" style={{ background: c.mutedheaderTextColor }} />
            )}
            {analysis.grade && <span>{analysis.grade} класс</span>}
          </div>
        )}
        {analysis.topic && (
          <div className="mt-1 text-lg font-bold uppercase leading-tight" style={{ color: c.lightTextColor }}>
            {analysis.topic}
          </div>
        )}
        {analysis.summary && (
          <div className="mt-1 text-xs uppercase leading-snug" style={{ color: c.mutedheaderTextColor }}>
            {analysis.summary}
          </div>
        )}
      </div>

      {/* Entity cards */}
      {items.map(({ e, bg, onBg }, i) => (
        <EntityCard key={i} entity={e} bg={bg} onBg={onBg} surface={c.surfaceColor} />
      ))}
    </div>
  );
}

function EntityCard({
  entity,
  bg,
  onBg,
  surface,
}: {
  entity: AnalysisEntity;
  bg: string;
  onBg: string;
  surface: string;
}) {
  const content = asLines(entity.content);
  const formula = asLines(entity.formula);
  const addendum = asLines(entity.cardAddendum);
  const items = entity.items ?? [];

  const surfaceStyle: CSSProperties = { background: surface, color: onBg };

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: bg, color: onBg }}>
      {entity.title && <div className="font-bold text-sm">{entity.title}</div>}
      {content.length > 0 &&
        (content.length === 1 ? (
          <div className="text-sm whitespace-pre-wrap">{content[0]}</div>
        ) : (
          <ul className="list-disc pl-5 text-sm space-y-1">
            {content.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        ))}

      {formula.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {formula.map((f, i) => (
            <div key={i} className="rounded-md px-2 py-1 font-mono text-sm inline-block" style={surfaceStyle}>
              {f}
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it, i) => (
            <GroupItemCard key={i} item={it} surface={surface} onBg={onBg} />
          ))}
        </div>
      )}

      {addendum.length > 0 && (
        <div className="rounded-md px-3 py-2 w-full text-sm space-y-1" style={surfaceStyle}>
          {addendum.map((a, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {a}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupItemCard({ item, surface, onBg }: { item: AnalysisGroupItem; surface: string; onBg: string }) {
  const content = asLines(item.content);
  const formula = asLines(item.formula);
  const addendum = asLines(item.cardAddendum);
  return (
    <div className="rounded-md px-3 py-2 space-y-1 text-sm" style={{ background: surface, color: onBg }}>
      {item.title && <div className="font-bold">{item.title}</div>}
      {content.length > 0 &&
        (content.length === 1 ? (
          <div className="whitespace-pre-wrap">{content[0]}</div>
        ) : (
          <ul className="list-disc pl-5 space-y-0.5">
            {content.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        ))}
      {formula.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {formula.map((f, i) => (
            <div key={i} className="rounded px-2 py-0.5 font-mono text-xs inline-block border border-current/20">
              {f}
            </div>
          ))}
        </div>
      )}
      {addendum.length > 0 && (
        <div className="text-xs opacity-80 space-y-0.5">
          {addendum.map((a, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {a}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
