import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { DesignProfile } from "@/lib/types";
import { Plus, Trash2, X } from "lucide-react";
import typographyOptions from "@/data/typography-options.json";

export const Route = createFileRoute("/design-profiles")({
  head: () => ({ meta: [{ title: "Профили дизайна — AI Infographic Generator" }] }),
  component: ProfilesPage,
});

const TYPO_STYLES = typographyOptions.typography_styles as Array<{ id: string; label: string; prompt: string }>;
const TYPO_SPECIFICITY = typographyOptions.font_specificity_modes as Array<{ id: string; label: string; prompt: string }>;

function ProfilesPage() {
  const profiles = useSettingsStore((s) => s.profiles);
  const upsert = useSettingsStore((s) => s.upsertProfile);
  const del = useSettingsStore((s) => s.deleteProfile);
  const reset = useSettingsStore((s) => s.resetProfiles);

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Профили дизайна</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            Сбросить к умолчаниям
          </Button>
          <Button
            size="sm"
            onClick={() => upsert({ ...profiles[0], profileName: `Профиль ${profiles.length + 1}` })}
          >
            Дублировать профиль
          </Button>
        </div>
      </div>
      {profiles.map((p) => (
        <ProfileEditor
          key={p.profileName}
          value={p}
          onChange={upsert}
          onDelete={() => del(p.profileName)}
          canDelete={profiles.length > 1}
        />
      ))}
    </div>
  );
}

function ProfileEditor({
  value,
  onChange,
  onDelete,
  canDelete,
}: {
  value: DesignProfile;
  onChange: (p: DesignProfile) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [draft, setDraft] = useState<DesignProfile>(value);

  const setColors = (patch: Partial<DesignProfile["colors"]>) =>
    setDraft({ ...draft, colors: { ...draft.colors, ...patch } });

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          className="font-semibold"
          value={draft.profileName}
          onChange={(e) => setDraft({ ...draft, profileName: e.target.value })}
        />
        <div className="flex gap-2 shrink-0">
          <Button size="sm" onClick={() => onChange(draft)}>Сохранить</Button>
          {canDelete && (
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <SingleColorRow
        title="Фон страницы"
        value={draft.colors.pageBackground}
        onChange={(v) => setColors({ pageBackground: v })}
      />
      <ColorListRow
        title="Яркие акценты"
        values={draft.colors.brightAccents}
        onChange={(v) => setColors({ brightAccents: v })}
      />
      <ColorListRow
        title="Пастельные заливки"
        values={draft.colors.pastelFills}
        onChange={(v) => setColors({ pastelFills: v })}
      />
      <ColorListRow
        title="Структурные / технические цвета"
        values={draft.colors.structural}
        onChange={(v) => setColors({ structural: v })}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Типографический характер</Label>
          <Select
            value={draft.typography.styleId}
            onValueChange={(v) => setDraft({ ...draft, typography: { ...draft.typography, styleId: v } })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPO_STYLES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Строгость выбора шрифта</Label>
          <Select
            value={draft.typography.specificityId}
            onValueChange={(v) => setDraft({ ...draft, typography: { ...draft.typography, specificityId: v } })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPO_SPECIFICITY.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Дополнительные инструкции</Label>
        <Textarea
          rows={10}
          value={draft.notesForAI}
          onChange={(e) => setDraft({ ...draft, notesForAI: e.target.value })}
          className="font-mono text-xs"
          placeholder="Свободные правила использования цветов, типографики, иконок…"
        />
      </div>
    </div>
  );
}

/* ---------- color UI ---------- */

function Swatch({ hex, large }: { hex: string; large?: boolean }) {
  return (
    <span
      className={`inline-block rounded border border-border align-middle ${large ? "size-5" : "size-4"}`}
      style={{ backgroundColor: hex }}
    />
  );
}

function ColorChip({ hex, onRemove }: { hex: string; onRemove?: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs">
      <Swatch hex={hex} />
      <span className="font-mono">{hex.toUpperCase()}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Удалить цвет"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

function ColorPickerPopover({
  initial = "#000000",
  onPick,
  trigger,
}: {
  initial?: string;
  onPick: (hex: string) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(initial);

  const normalize = (s: string) => {
    let v = s.trim();
    if (!v.startsWith("#")) v = `#${v}`;
    return v;
  };
  const valid = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Выберите цвет</Label>
          <input
            type="color"
            value={valid ? hex : "#000000"}
            onChange={(e) => setHex(e.target.value)}
            className="h-10 w-full cursor-pointer rounded border border-border bg-transparent"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">HEX</Label>
          <Input
            value={hex}
            onChange={(e) => setHex(normalize(e.target.value))}
            placeholder="#RRGGBB"
            className="font-mono"
          />
        </div>
        <div className="flex items-center justify-between">
          <Swatch hex={valid ? hex : "#000000"} large />
          <Button
            size="sm"
            disabled={!valid}
            onClick={() => {
              onPick(hex.toUpperCase());
              setOpen(false);
            }}
          >
            Добавить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SingleColorRow({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{title}</Label>
      <div className="flex flex-wrap items-center gap-1 mt-1">
        <ColorChip hex={value} />
        <ColorPickerPopover
          initial={value}
          onPick={onChange}
          trigger={
            <button
              type="button"
              title="Изменить цвет"
              className="inline-flex size-6 items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:bg-muted"
            >
              <Plus className="size-3.5" />
            </button>
          }
        />
      </div>
    </div>
  );
}

function ColorListRow({
  title,
  values,
  onChange,
}: {
  title: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const add = (hex: string) => {
    if (!values.includes(hex)) onChange([...values, hex]);
  };
  const remove = (hex: string) => onChange(values.filter((v) => v !== hex));
  return (
    <div>
      <Label className="text-xs">{title}</Label>
      <div className="flex flex-wrap items-center gap-1 mt-1">
        {values.map((hex) => (
          <ColorChip key={hex} hex={hex} onRemove={() => remove(hex)} />
        ))}
        <ColorPickerPopover
          onPick={add}
          trigger={
            <button
              type="button"
              title="Добавить цвет"
              className="inline-flex size-6 items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:bg-muted"
            >
              <Plus className="size-3.5" />
            </button>
          }
        />
      </div>
    </div>
  );
}
