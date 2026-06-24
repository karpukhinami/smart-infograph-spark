import { useState, type CSSProperties } from "react";
import type { AnalysisEntity, AnalysisGroupItem, AnalysisJson, AnalysisSectionId, DesignProfile } from "@/lib/types";
import { Markdown } from "@/components/workspace/Markdown";
import { EntityEditDialog } from "@/components/workspace/EntityEditDialog";
import { HeaderEditDialog } from "@/components/workspace/HeaderEditDialog";
import { useProjectStore } from "@/store/useProjectStore";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronUp, ChevronDown, X, Plus } from "lucide-react";

interface Props {
  analysis: AnalysisJson;
  profile: DesignProfile | null;
  editable?: boolean;
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

const SECTION_OPTIONS: { value: AnalysisSectionId; label: string }[] = [
  { value: "prerequisites", label: "Предпосылки" },
  { value: "main", label: "Основное содержание" },
  { value: "additions", label: "Выводы и дополнения" },
];

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

export function SimpleContentPreview({ analysis, profile, editable = true }: Props) {
  const c = { ...FALLBACK, ...(profile?.colors ?? {}) };
  const entities = analysis.entities ?? [];
  const updateEntity = useProjectStore((s) => s.updateActiveAnalysisEntity);
  const deleteEntity = useProjectStore((s) => s.deleteActiveAnalysisEntity);
  const swapEntities = useProjectStore((s) => s.swapActiveAnalysisEntities);
  const addEntity = useProjectStore((s) => s.addActiveAnalysisEntity);
  const updateHeader = useProjectStore((s) => s.updateActiveAnalysisHeader);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [changeSec, setChangeSec] = useState<{ index: number; section: AnalysisSectionId | "" } | null>(null);

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

  const headerInner = (
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
  );

  const handleMove = (index: number, direction: -1 | 1) => {
    const neighborIdx = index + direction;
    const cur = entities[index];
    const neighbor = entities[neighborIdx];
    if (neighbor && neighbor.sectionId === cur.sectionId) {
      swapEntities(index, neighborIdx);
    } else {
      // Cannot swap across sections — prompt to change section instead.
      setChangeSec({ index, section: cur.sectionId });
    }
  };

  return (
    <div className="space-y-3" style={{ color: c.inkColor }}>
      {/* Header card (no move/delete controls) */}
      {editable ? (
        <button
          type="button"
          onClick={() => setHeaderOpen(true)}
          className="block w-full text-left cursor-pointer rounded-xl transition-transform hover:scale-[1.005] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Нажмите, чтобы отредактировать шапку"
        >
          {headerInner}
        </button>
      ) : (
        headerInner
      )}

      {/* Entity cards */}
      {items.map(({ e, bg, onBg }, i) =>
        editable ? (
          <div
            key={i}
            className="relative group rounded-xl"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => setEditIndex(i)}
              onKeyDown={(ev) => { if (ev.key === "Enter") setEditIndex(i); }}
              className="block w-full text-left cursor-pointer rounded-xl transition-transform hover:scale-[1.005] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Нажмите, чтобы отредактировать"
            >
              <EntityCard entity={e} accent={bg} onBg={onBg} surface={c.surfaceColor} />
            </div>
            {/* Move + delete buttons (top-left) */}
            <div className="absolute top-2 left-2 flex gap-1 z-10">
              <button
                type="button"
                onClick={(ev) => { ev.stopPropagation(); handleMove(i, -1); }}
                disabled={i === 0}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-foreground shadow hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                title="Переместить вверх"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(ev) => { ev.stopPropagation(); handleMove(i, 1); }}
                disabled={i === entities.length - 1}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-foreground shadow hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                title="Переместить вниз"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(ev) => { ev.stopPropagation(); setDeleteIndex(i); }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-foreground shadow hover:bg-white"
                title="Удалить карточку"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <EntityCard key={i} entity={e} accent={bg} onBg={onBg} surface={c.surfaceColor} />
        ),
      )}


      {/* Add card button */}
      {editable && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/40 px-4 py-4 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Добавить карточку</span>
        </button>
      )}

      {editable && (
        <>
          <EntityEditDialog
            open={editIndex !== null}
            entity={editIndex !== null ? entities[editIndex] ?? null : null}
            onClose={() => setEditIndex(null)}
            onSave={(patch) => {
              if (editIndex !== null) updateEntity(editIndex, patch);
            }}
          />

          <EntityEditDialog
            open={addOpen}
            entity={null}
            isNew
            onClose={() => setAddOpen(false)}
            onSave={(patch) => {
              if (!patch.sectionId) return;
              const newEntity: AnalysisEntity = {
                sectionId: patch.sectionId as AnalysisSectionId,
                entityType: patch.entityType ?? "custom",
                attention: patch.attention ?? "normal",
                title: patch.title ?? null,
                content: patch.content ?? null,
                formula: patch.formula ?? null,
                cardAddendum: patch.cardAddendum ?? null,
                icon: patch.icon ?? null,
                visual: patch.visual ?? null,
              };
              addEntity(newEntity);
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

          {/* Delete confirmation */}
          <Dialog open={deleteIndex !== null} onOpenChange={(v) => { if (!v) setDeleteIndex(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Удалить карточку?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Карточка вместе со всем содержимым будет удалена.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteIndex(null)}>Оставить</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (deleteIndex !== null) deleteEntity(deleteIndex);
                    setDeleteIndex(null);
                  }}
                >
                  Удалить
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Change section dialog */}
          <Dialog open={changeSec !== null} onOpenChange={(v) => { if (!v) setChangeSec(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Смените раздел карточки</DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="change-sec">Раздел</Label>
                <Select
                  value={changeSec?.section ?? ""}
                  onValueChange={(v) =>
                    setChangeSec((prev) => (prev ? { ...prev, section: v as AnalysisSectionId } : prev))
                  }
                >
                  <SelectTrigger id="change-sec">
                    <SelectValue placeholder="Выберите раздел" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setChangeSec(null)}>Отмена</Button>
                <Button
                  disabled={!changeSec?.section}
                  onClick={() => {
                    if (changeSec && changeSec.section) {
                      updateEntity(changeSec.index, { sectionId: changeSec.section as AnalysisSectionId });
                    }
                    setChangeSec(null);
                  }}
                >
                  Сохранить
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function EntityCard({
  entity,
  accent,
  onBg,
  surface,
}: {
  entity: AnalysisEntity;
  accent: string;
  onBg: string;
  surface: string;
}) {
  const content = asLines(entity.content);
  const formula = asLines(entity.formula);
  const addendum = asLines(entity.cardAddendum);
  const items = entity.items ?? [];

  const PALE = "#EEF0F3";
  const surfaceStyle: CSSProperties = { background: surface, color: onBg };

  return (
    <div className="relative rounded-xl p-3 space-y-2" style={{ background: PALE, color: onBg }}>
      <span
        aria-hidden
        className="absolute top-2 right-2 inline-block h-3 w-3 rounded-full ring-2 ring-white"
        style={{ background: accent }}
      />
      {entity.title && <div className="font-bold text-sm pr-6"><Markdown>{entity.title}</Markdown></div>}
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
