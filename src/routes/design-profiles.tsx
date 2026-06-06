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
import { useSettingsStore } from "@/store/useSettingsStore";
import type { DesignProfile } from "@/lib/types";
import { Trash2, X } from "lucide-react";
import {
  COLOR_PALETTE,
  FONT_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  BORDER_RADIUS_OPTIONS,
  BORDER_OPTIONS,
} from "@/data/design-options";

export const Route = createFileRoute("/design-profiles")({
  head: () => ({ meta: [{ title: "Профили дизайна — AI Infographic Generator" }] }),
  component: ProfilesPage,
});

function ProfilesPage() {
  const profiles = useSettingsStore((s) => s.profiles);
  const upsert = useSettingsStore((s) => s.upsertProfile);
  const del = useSettingsStore((s) => s.deleteProfile);

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Профили дизайна</h1>
        <Button
          size="sm"
          onClick={() =>
            upsert({
              ...profiles[0],
              profileName: `Профиль ${profiles.length + 1}`,
            })
          }
        >
          Дублировать стандартный
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Цвета и шрифты выбираются из готовых палитр и списков. Списки можно расширить
        в файле <code>src/data/design-options.ts</code>.
      </p>
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
  const [draft, setDraft] = useState(value);

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ColorPicker
          label="Фон"
          value={draft.background}
          onChange={(v) => setDraft({ ...draft, background: v })}
        />
        <ColorPicker
          label="Основной акцент"
          value={draft.accents.primary}
          onChange={(v) => setDraft({ ...draft, accents: { ...draft.accents, primary: v } })}
        />
        <ColorPicker
          label="Дополнительный акцент"
          value={draft.accents.secondary}
          onChange={(v) => setDraft({ ...draft, accents: { ...draft.accents, secondary: v } })}
        />
        <MultiColorPicker
          label="Прочие акценты"
          values={draft.accents.additional}
          onChange={(v) => setDraft({ ...draft, accents: { ...draft.accents, additional: v } })}
        />

        <FontPicker
          label="Основной шрифт"
          family={draft.fonts.primary.family}
          weights={draft.fonts.primary.weights}
          onChange={(family, weights) =>
            setDraft({ ...draft, fonts: { ...draft.fonts, primary: { family, weights } } })
          }
        />
        <FontPicker
          label="Дополнительный шрифт"
          family={draft.fonts.secondary.family}
          weights={draft.fonts.secondary.weights}
          onChange={(family, weights) =>
            setDraft({ ...draft, fonts: { ...draft.fonts, secondary: { family, weights } } })
          }
        />

        <SelectField
          label="Скругление углов"
          value={draft.cardStyle.borderRadius}
          options={BORDER_RADIUS_OPTIONS}
          onChange={(v) => setDraft({ ...draft, cardStyle: { ...draft.cardStyle, borderRadius: v } })}
        />
        <SelectField
          label="Обводка"
          value={draft.cardStyle.border}
          options={BORDER_OPTIONS}
          onChange={(v) => setDraft({ ...draft, cardStyle: { ...draft.cardStyle, border: v } })}
        />
      </div>

      <div>
        <Label className="text-xs">Дополнительные инструкции (свободный текст для модели)</Label>
        <Textarea
          rows={4}
          value={draft.notesForAI}
          onChange={(e) => setDraft({ ...draft, notesForAI: e.target.value })}
          placeholder="Любые свободные указания: фирменный стиль, ограничения, предпочтения…"
        />
      </div>
    </div>
  );
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span
      className="inline-block size-4 rounded border border-border align-middle"
      style={{ backgroundColor: hex }}
    />
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue>
            <span className="flex items-center gap-2">
              <Swatch hex={value} />
              <span className="text-xs font-mono">{value}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COLOR_PALETTE.map((c) => (
            <SelectItem key={c.hex} value={c.hex}>
              <span className="flex items-center gap-2">
                <Swatch hex={c.hex} />
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{c.hex}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MultiColorPicker({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const add = (hex: string) => {
    if (!values.includes(hex)) onChange([...values, hex]);
  };
  const remove = (hex: string) => onChange(values.filter((v) => v !== hex));

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1 mb-1 min-h-7">
        {values.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => remove(hex)}
            className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs hover:bg-muted"
          >
            <Swatch hex={hex} />
            <span className="font-mono">{hex}</span>
            <X className="size-3" />
          </button>
        ))}
      </div>
      <Select value="" onValueChange={add}>
        <SelectTrigger>
          <SelectValue placeholder="Добавить цвет…" />
        </SelectTrigger>
        <SelectContent>
          {COLOR_PALETTE.map((c) => (
            <SelectItem key={c.hex} value={c.hex}>
              <span className="flex items-center gap-2">
                <Swatch hex={c.hex} />
                <span>{c.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FontPicker({
  label,
  family,
  weights,
  onChange,
}: {
  label: string;
  family: string;
  weights: string[];
  onChange: (family: string, weights: string[]) => void;
}) {
  const toggleWeight = (w: string) => {
    const next = weights.includes(w) ? weights.filter((x) => x !== w) : [...weights, w];
    onChange(family, next);
  };
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={family} onValueChange={(v) => onChange(v, weights)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_OPTIONS.map((f) => (
            <SelectItem key={f} value={f}>
              <span style={{ fontFamily: f }}>{f}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-wrap gap-1 mt-1">
        {FONT_WEIGHT_OPTIONS.map((w) => {
          const on = weights.includes(w);
          return (
            <button
              key={w}
              type="button"
              onClick={() => toggleWeight(w)}
              className={`rounded border px-1.5 py-0.5 text-[10px] ${
                on
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
