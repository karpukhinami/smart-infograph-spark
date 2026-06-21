import { useState, type CSSProperties } from "react";
import type { AnalysisEntity, AnalysisGroupItem, AnalysisJson, DesignProfile } from "@/lib/types";
import { Markdown } from "@/components/workspace/Markdown";
import { EntityEditDialog } from "@/components/workspace/EntityEditDialog";
import { HeaderEditDialog } from "@/components/workspace/HeaderEditDialog";
import { useProjectStore } from "@/store/useProjectStore";

interface Props {
  analysis: AnalysisJson;
  profile: DesignProfile | null;
}

function isOther(v: string | null | undefined): boolean {
  return !!v && v.trim().toLowerCase() === "другое";
}
function displayMeta(v: string | null | undefined): string | null {
  if (!v) return null;
  return isOther(v) ? null : v;
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
  const updateEntity = useProjectStore((s) => s.updateActiveAnalysisEntity);
  const updateHeader = useProjectStore((s) => s.updateActiveAnalysisHeader);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [headerOpen, setHeaderOpen] = useState(false);

  const subjectShown = displayMeta(analysis.subject);
  const gradeShown = displayMeta(analysis.grade);

  // Assign alternating pastel index to "normal" entities only.
  let normalRun = 0;
  const items = entities.map((e) => {
    const att = String(e.attention ?? "normal").toLowerCase();
    let bg = c.detailSoftColor;
    let onBg = c.inkColor;
    if (att === "core" || att === "main") {
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

  return (
    <div className="space-y-3" style={{ color: c.inkColor }}>
      {/* Header card */}
      <button
        type="button"
        onClick={() => setHeaderOpen(true)}
        className="block w-full text-left cursor-pointer rounded-xl transition-transform hover:scale-[1.005] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Нажмите, чтобы отредактировать шапку"
      >
        <div className="rounded-xl px-4 py-3" style={{ background: c.headerColor, color: c.lightTextColor }}>
          {(subjectShown || gradeShown) && (
            <div className="flex items-center gap-2 text-xs" style={{ color: c.mutedheaderTextColor }}>
              {subjectShown && <span>{subjectShown}</span>}
              {subjectShown && gradeShown && (
                <span className="inline-block size-1.5 rounded-full" style={{ background: c.mutedheaderTextColor }} />
              )}
              {gradeShown && <span>{gradeShown} класс</span>}
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
      </button>

      {/* Entity cards */}
      {items.map(({ e, bg, onBg }, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setEditIndex(i)}
          className="block w-full text-left cursor-pointer rounded-xl transition-transform hover:scale-[1.005] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Нажмите, чтобы отредактировать"
        >
          <EntityCard entity={e} bg={bg} onBg={onBg} surface={c.surfaceColor} />
        </button>
      ))}

      <EntityEditDialog
        open={editIndex !== null}
        entity={editIndex !== null ? entities[editIndex] ?? null : null}
        onClose={() => setEditIndex(null)}
        onSave={(patch) => {
          if (editIndex !== null) updateEntity(editIndex, patch);
        }}
      />

      <HeaderEditDialog
        open={headerOpen}
        value={headerOpen ? {
          topic: analysis.topic ?? "",
          subject: analysis.subject ?? null,
          grade: analysis.grade ?? null,
          summary: analysis.summary ?? "",
        } : null}
        onClose={() => setHeaderOpen(false)}
        onSave={(patch) => updateHeader(patch)}
      />
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
      {entity.title && <div className="font-bold text-sm"><Markdown>{entity.title}</Markdown></div>}
      {content.length > 0 && (
        content.length === 1 ? (
          <div className="text-sm"><Markdown>{content[0]}</Markdown></div>
        ) : (
          <ul className="list-disc pl-5 text-sm space-y-1">
            {content.map((l, i) => (
              <li key={i}><Markdown>{l}</Markdown></li>
            ))}
          </ul>
        )
      )}

      {formula.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {formula.map((f, i) => (
            <div key={i} className="rounded-md px-2 py-1 text-sm inline-block" style={surfaceStyle}>
              <Markdown>{wrapMath(f)}</Markdown>
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
            <div key={i}><Markdown>{a}</Markdown></div>
          ))}
        </div>
      )}
    </div>
  );
}

function wrapMath(s: string): string {
  const t = s.trim();
  if (!t) return s;
  // Already contains $...$ or $$...$$ delimiters
  if (/\$.+\$/.test(t)) return s;
  return `$${t}$`;
}

function GroupItemCard({ item, surface, onBg }: { item: AnalysisGroupItem; surface: string; onBg: string }) {
  const content = asLines(item.content);
  const formula = asLines(item.formula);
  const addendum = asLines(item.cardAddendum);
  return (
    <div className="rounded-md px-3 py-2 space-y-1 text-sm" style={{ background: surface, color: onBg }}>
      {item.title && <div className="font-bold"><Markdown>{item.title}</Markdown></div>}
      {content.length > 0 && (
        content.length === 1 ? (
          <div><Markdown>{content[0]}</Markdown></div>
        ) : (
          <ul className="list-disc pl-5 space-y-0.5">
            {content.map((l, i) => (
              <li key={i}><Markdown>{l}</Markdown></li>
            ))}
          </ul>
        )
      )}
      {formula.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {formula.map((f, i) => (
            <div key={i} className="rounded px-2 py-0.5 text-xs inline-block border border-current/20">
              <Markdown>{wrapMath(f)}</Markdown>
            </div>
          ))}
        </div>
      )}
      {addendum.length > 0 && (
        <div className="text-xs opacity-80 space-y-0.5">
          {addendum.map((a, i) => (
            <div key={i}><Markdown>{a}</Markdown></div>
          ))}
        </div>
      )}
    </div>
  );
}
