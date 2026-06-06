import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { InfographicStyle } from "@/lib/types";

export const Route = createFileRoute("/styles")({
  head: () => ({ meta: [{ title: "Стили — AI Infographic Generator" }] }),
  component: StylesPage,
});

function StylesPage() {
  const styles = useSettingsStore((s) => s.styles);
  const upsert = useSettingsStore((s) => s.upsertStyle);
  const toggle = useSettingsStore((s) => s.toggleStyle);
  const reset = useSettingsStore((s) => s.resetStyles);
  const guidelines = useSettingsStore((s) => s.styleGuidelines);
  const setGuidelines = useSettingsStore((s) => s.setStyleGuidelines);

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Стили инфографики</h1>
        <Button variant="outline" size="sm" onClick={reset}>Сбросить к умолчаниям</Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <Label className="text-sm font-semibold">Общие правила формирования инфографики</Label>
        <p className="text-xs text-muted-foreground">
          Эти правила применяются ко всем стилям и передаются модели на этапе создания дизайн-брифа.
        </p>
        <Textarea
          rows={10}
          value={guidelines}
          onChange={(e) => setGuidelines(e.target.value)}
          className="font-mono text-xs"
        />
      </div>

      {styles.map((s) => <StyleEditor key={s.id} value={s} onChange={upsert} onToggle={toggle} />)}
    </div>
  );
}

function StyleEditor({
  value,
  onChange,
  onToggle,
}: { value: InfographicStyle; onChange: (s: InfographicStyle) => void; onToggle: (id: string, e: boolean) => void }) {
  const update = <K extends keyof InfographicStyle["rules"]>(k: K, v: string) =>
    onChange({ ...value, rules: { ...value.rules, [k]: v } });

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          className="font-semibold"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        <div className="flex items-center gap-2 shrink-0">
          <Label className="text-xs">Включён</Label>
          <Switch checked={value.enabled} onCheckedChange={(c) => onToggle(value.id, c)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Краткое описание</Label>
        <Textarea
          rows={2}
          value={value.shortDescription}
          onChange={(e) => onChange({ ...value, shortDescription: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(value.rules) as Array<keyof InfographicStyle["rules"]>).map((k) => (
          <div key={k}>
            <Label className="text-xs">{RULE_LABELS[k]}</Label>
            <Input value={value.rules[k]} onChange={(e) => update(k, e.target.value)} />
          </div>
        ))}
      </div>
    </div>
  );
}

const RULE_LABELS: Record<keyof InfographicStyle["rules"], string> = {
  composition: "Композиция",
  symmetry: "Симметрия",
  primaryCarrier: "Основной носитель",
  colorApproach: "Подход к цвету",
  typography: "Типографика",
  illustration: "Иллюстрации",
  character: "Характер",
};
