import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { DesignProfile } from "@/lib/types";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/design-profiles")({
  head: () => ({ meta: [{ title: "Design Profiles — AI Infographic Generator" }] }),
  component: ProfilesPage,
});

function ProfilesPage() {
  const profiles = useSettingsStore((s) => s.profiles);
  const upsert = useSettingsStore((s) => s.upsertProfile);
  const del = useSettingsStore((s) => s.deleteProfile);

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Design Profiles</h1>
        <Button
          size="sm"
          onClick={() =>
            upsert({
              ...profiles[0],
              profileName: `Profile ${profiles.length + 1}`,
            })
          }
        >
          Duplicate default
        </Button>
      </div>
      {profiles.map((p) => (
        <ProfileEditor key={p.profileName} value={p} onChange={upsert} onDelete={() => del(p.profileName)} canDelete={profiles.length > 1} />
      ))}
    </div>
  );
}

function ProfileEditor({
  value, onChange, onDelete, canDelete,
}: { value: DesignProfile; onChange: (p: DesignProfile) => void; onDelete: () => void; canDelete: boolean }) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          className="font-semibold"
          value={draft.profileName}
          onChange={(e) => setDraft({ ...draft, profileName: e.target.value })}
        />
        <div className="flex gap-2 shrink-0">
          <Button size="sm" onClick={() => onChange(draft)}>Save</Button>
          {canDelete && (
            <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="size-4" /></Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Background" value={draft.background} onChange={(v) => setDraft({ ...draft, background: v })} />
        <Field label="Primary accent" value={draft.accents.primary} onChange={(v) => setDraft({ ...draft, accents: { ...draft.accents, primary: v } })} />
        <Field label="Secondary accent" value={draft.accents.secondary} onChange={(v) => setDraft({ ...draft, accents: { ...draft.accents, secondary: v } })} />
        <Field label="Additional accents (comma)" value={draft.accents.additional.join(", ")} onChange={(v) => setDraft({ ...draft, accents: { ...draft.accents, additional: v.split(",").map((x) => x.trim()).filter(Boolean) } })} />
        <Field label="Primary font" value={draft.fonts.primary.family} onChange={(v) => setDraft({ ...draft, fonts: { ...draft.fonts, primary: { ...draft.fonts.primary, family: v } } })} />
        <Field label="Primary weights" value={draft.fonts.primary.weights.join(", ")} onChange={(v) => setDraft({ ...draft, fonts: { ...draft.fonts, primary: { ...draft.fonts.primary, weights: v.split(",").map((x) => x.trim()).filter(Boolean) } } })} />
        <Field label="Secondary font" value={draft.fonts.secondary.family} onChange={(v) => setDraft({ ...draft, fonts: { ...draft.fonts, secondary: { ...draft.fonts.secondary, family: v } } })} />
        <Field label="Secondary weights" value={draft.fonts.secondary.weights.join(", ")} onChange={(v) => setDraft({ ...draft, fonts: { ...draft.fonts, secondary: { ...draft.fonts.secondary, weights: v.split(",").map((x) => x.trim()).filter(Boolean) } } })} />
        <Field label="Border radius" value={draft.cardStyle.borderRadius} onChange={(v) => setDraft({ ...draft, cardStyle: { ...draft.cardStyle, borderRadius: v } })} />
        <Field label="Border" value={draft.cardStyle.border} onChange={(v) => setDraft({ ...draft, cardStyle: { ...draft.cardStyle, border: v } })} />
      </div>
      <div>
        <Label className="text-xs">Notes for AI</Label>
        <Textarea rows={3} value={draft.notesForAI} onChange={(e) => setDraft({ ...draft, notesForAI: e.target.value })} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
