import { useEffect, useState } from "react";
import { Anchor, ImageIcon, Pencil } from "lucide-react";
import type { ConnectionEntity, ConnectionSchemaJson, DesignProfile } from "@/lib/types";
import { ORGANIZATION_TYPE_LABELS, asAddendumLines } from "@/lib/connection-schema";
import { Markdown } from "@/components/workspace/Markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectStore } from "@/store/useProjectStore";

interface Props {
  connection: ConnectionSchemaJson;
  profile: DesignProfile | null;
  editable?: boolean;
}

const FALLBACK = {
  backgroundColor: "#F5F6FF",
  surfaceColor: "#FFFFFF",
  headerColor: "#1A2236",
  lightTextColor: "#FFFFFF",
  mutedheaderTextColor: "#9399BD",
  inkColor: "#101828",
};

function arrowOf(direction: string): string {
  if (direction === "two_way") return "↔";
  if (direction === "none") return "—";
  return "→";
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.filter((x) => x != null).map((x) => String(x)).join("\n");
  return String(v);
}

/** Balance check for $...$ and markdown backticks, mirrors the bento editor rules. */
function validateMarkup(input: unknown): string | null {
  const value = asText(input);
  const dollars = (value.match(/(?<!\\)\$/g) ?? []).length;
  if (dollars % 2 !== 0) return "Непарное количество символов $ (LaTeX)";
  const ticks = (value.match(/`/g) ?? []).length;
  if (ticks % 2 !== 0) return "Непарное количество символов ` (markdown)";
  const stars = (value.match(/\*\*/g) ?? []).length;
  if (stars % 2 !== 0) return "Непарное количество ** (markdown)";
  return null;
}

export function ConnectionSchemaPreview({ connection, profile, editable = true }: Props) {
  const c = { ...FALLBACK, ...(profile?.colors ?? {}) };
  const updateEntity = useProjectStore((s) => s.updateActiveConnectionEntity);
  const updateRegion = useProjectStore((s) => s.updateActiveConnectionRegion);
  const [edit, setEdit] = useState<{ region: number; entity: number } | null>(null);
  const [regionEdit, setRegionEdit] = useState<number | null>(null);

  const current =
    edit !== null ? connection.regions[edit.region]?.entities[edit.entity] ?? null : null;

  return (
    <div className="space-y-4" style={{ color: c.inkColor }}>
      <div className="rounded-xl px-4 py-3" style={{ background: c.headerColor, color: c.lightTextColor }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: c.mutedheaderTextColor }}>
          {connection.subject && <span>{connection.subject}</span>}
          {connection.subject && connection.grade && <span>·</span>}
          {connection.grade && <span>{connection.grade} класс</span>}
        </div>
        {connection.topic && (
          <div className="mt-1 text-lg font-bold uppercase leading-tight">{connection.topic}</div>
        )}
        {connection.displaySubtitle && (
          <div className="mt-1 text-xs leading-snug" style={{ color: c.mutedheaderTextColor }}>
            <Markdown>{connection.displaySubtitle}</Markdown>
          </div>
        )}
        {connection.focusQuestion && (
          <div className="mt-2 text-[11px] italic" style={{ color: c.mutedheaderTextColor }}>
            Фокусный вопрос: {connection.focusQuestion}
          </div>
        )}
      </div>

      {connection.regions.map((region, ri) => {
        const byId = new Map(region.entities.map((e) => [e.id, e]));
        return (
          <div key={region.id} className="rounded-xl border-2 border-dashed border-muted-foreground/40 p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">
                  Регион {region.number ?? ri + 1}
                  {region.title ? ` · ${region.title}` : ""}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {ORGANIZATION_TYPE_LABELS[region.organizationType] ?? region.organizationType}
                </div>
              </div>
              {editable && (
                <Button size="sm" variant="ghost" onClick={() => setRegionEdit(ri)}>
                  <Pencil className="size-3.5 mr-1" /> Регион
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {region.entities.map((e, ei) => {
                const isAnchor = region.anchorEntityId === e.id;
                const add = asAddendumLines(e.addendum);
                return (
                  <div
                    key={e.id}
                    role={editable ? "button" : undefined}
                    tabIndex={editable ? 0 : undefined}
                    onClick={editable ? () => setEdit({ region: ri, entity: ei }) : undefined}
                    onKeyDown={
                      editable
                        ? (ev) => {
                            if (ev.key === "Enter") setEdit({ region: ri, entity: ei });
                          }
                        : undefined
                    }
                    className={`relative rounded-xl p-3 space-y-2 transition-transform ${
                      editable ? "cursor-pointer hover:scale-[1.005]" : ""
                    } ${isAnchor ? "ring-2 ring-offset-1 ring-foreground/40" : ""}`}
                    style={{ background: "#EEF0F3" }}
                    title={editable ? "Нажмите, чтобы отредактировать" : undefined}
                  >
                    {isAnchor && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium shadow">
                        <Anchor className="size-3" /> Якорь
                      </span>
                    )}
                    {e.title && (
                      <div className="font-bold text-sm pr-16">
                        <Markdown>{e.title}</Markdown>
                      </div>
                    )}
                    {e.text && (
                      <div className="text-sm">
                        <Markdown>{e.text}</Markdown>
                      </div>
                    )}
                    {add.length > 0 && (
                      <div className="rounded-md bg-white px-3 py-2 text-sm space-y-1">
                        {add.map((a, i) => (
                          <div key={i}>
                            <Markdown>{a}</Markdown>
                          </div>
                        ))}
                      </div>
                    )}
                    {e.depiction && (
                      <div className="flex items-start gap-2 rounded-md border border-dashed border-muted-foreground/40 px-2 py-1.5 text-xs text-muted-foreground">
                        <ImageIcon className="size-3.5 mt-0.5 shrink-0" />
                        <span>{e.depiction}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {region.relations.length > 0 && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
                <div className="font-medium">Связи</div>
                {region.relations.map((rel, i) => (
                  <div key={i}>
                    {byId.get(rel.from)?.title || byId.get(rel.from)?.text || rel.from} {arrowOf(rel.direction)}{" "}
                    {byId.get(rel.to)?.title || byId.get(rel.to)?.text || rel.to}
                    {rel.label ? ` — ${rel.label}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {connection.regionRelations.length > 0 && (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
          <div className="font-medium">Связи между регионами</div>
          {connection.regionRelations.map((rel, i) => (
            <div key={i}>
              {rel.fromRegion} {arrowOf(rel.direction)} {rel.toRegion}
              {rel.label ? ` — ${rel.label}` : ""}
            </div>
          ))}
        </div>
      )}

      {editable && (
        <>
          <EntityDialog
            open={edit !== null}
            entity={current}
            onClose={() => setEdit(null)}
            onSave={(patch) => {
              if (edit) updateEntity(edit.region, edit.entity, patch);
              setEdit(null);
            }}
          />
          <RegionDialog
            open={regionEdit !== null}
            region={regionEdit !== null ? connection.regions[regionEdit] ?? null : null}
            onClose={() => setRegionEdit(null)}
            onSave={(patch) => {
              if (regionEdit !== null) updateRegion(regionEdit, patch);
              setRegionEdit(null);
            }}
          />
        </>
      )}
    </div>
  );
}

function EntityDialog({
  open,
  entity,
  onClose,
  onSave,
}: {
  open: boolean;
  entity: ConnectionEntity | null;
  onClose: () => void;
  onSave: (patch: Partial<ConnectionEntity>) => void;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [addendum, setAddendum] = useState("");
  const [depiction, setDepiction] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !entity) return;
    setTitle(entity.title ?? "");
    setText(entity.text ?? "");
    setAddendum(asAddendumLines(entity.addendum).join("\n"));
    setDepiction(entity.depiction ?? "");
    setError(null);
  }, [open, entity]);

  function submit() {
    for (const [label, value] of [
      ["Заголовок", title],
      ["Содержание", text],
      ["Дополнение", addendum],
    ] as const) {
      const err = validateMarkup(value);
      if (err) {
        setError(`${label}: ${err}`);
        return;
      }
    }
    if (!title.trim() && !text.trim() && !depiction.trim()) {
      setError("Нужно заполнить хотя бы одно из полей: заголовок, содержание или описание изображения");
      return;
    }
    const lines = addendum.split("\n").map((l) => l.trim()).filter(Boolean);
    onSave({
      title: title.trim() || null,
      text: text.trim() || null,
      addendum: lines.length === 0 ? null : lines.length === 1 ? lines[0] : lines,
      depiction: depiction.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Редактирование сущности</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Заголовок</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Содержание</Label>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Дополнение (каждая строка — отдельный пункт)</Label>
            <Textarea rows={2} value={addendum} onChange={(e) => setAddendum(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Описание изображения</Label>
            <Textarea rows={2} value={depiction} onChange={(e) => setDepiction(e.target.value)} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={submit}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegionDialog({
  open,
  region,
  onClose,
  onSave,
}: {
  open: boolean;
  region: ConnectionSchemaJson["regions"][number] | null;
  onClose: () => void;
  onSave: (patch: Partial<ConnectionSchemaJson["regions"][number]>) => void;
}) {
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [anchor, setAnchor] = useState("");
  const [orgType, setOrgType] = useState("");

  useEffect(() => {
    if (!open || !region) return;
    setTitle(region.title ?? "");
    setNumber(region.number ?? "");
    setAnchor(region.anchorEntityId ?? "__none__");
    setOrgType(region.organizationType);
  }, [open, region]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Настройки региона</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Заголовок региона</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Номер (необязательно)</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Тип организации</Label>
            <Select value={orgType} onValueChange={setOrgType}>
              <SelectTrigger><SelectValue placeholder="Выберите тип" /></SelectTrigger>
              <SelectContent>
                {Object.entries(ORGANIZATION_TYPE_LABELS).map(([id, label]) => (
                  <SelectItem key={id} value={id}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Якорная сущность</Label>
            <Select value={anchor} onValueChange={setAnchor}>
              <SelectTrigger><SelectValue placeholder="Не задана" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Не задана</SelectItem>
                {(region?.entities ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.title || e.text || e.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            onClick={() =>
              onSave({
                title: title.trim() || null,
                number: number.trim() || null,
                organizationType: orgType,
                anchorEntityId: anchor === "__none__" ? null : anchor,
              })
            }
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
