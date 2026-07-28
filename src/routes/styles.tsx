import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSettingsStore, useCurrentStyles } from "@/store/useSettingsStore";
import type { InfographicStyle } from "@/lib/types";

export const Route = createFileRoute("/styles")({
  head: () => ({ meta: [{ title: "Стили — AI Infographic Generator" }] }),
  component: StylesPage,
});

function StylesPage() {
  const mode = useSettingsStore((s) => s.mode);
  const styles = useCurrentStyles();
  const upsert = useSettingsStore((s) => s.upsertStyle);
  const toggle = useSettingsStore((s) => s.toggleStyle);
  const reset = useSettingsStore((s) => s.resetStyles);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            Стили инфографики — режим «{mode === "free" ? "вольный" : "строгий"}»
          </h1>
          <Button variant="outline" size="sm" onClick={reset}>
            Сбросить к умолчаниям
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Стили хранятся отдельно для каждого режима. Для каждого стиля задаются общие
          правила композиции, конкретные правила оформления элементов и признаки стиля —
          именно признаки используются в подборе стиля по кнопке «Определить стиль».
        </p>

        {styles.map((s) => (
          <StyleEditor key={s.id} value={s} onChange={upsert} onToggle={toggle} />
        ))}
      </div>
    </div>
  );
}

function StyleEditor({
  value,
  onChange,
  onToggle,
}: {
  value: InfographicStyle;
  onChange: (s: InfographicStyle) => void;
  onToggle: (id: string, e: boolean) => void;
}) {
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

      <div>
        <Label className="text-xs">Общие правила (композиция и подход)</Label>
        <Textarea
          rows={5}
          value={value.generalRules}
          onChange={(e) => onChange({ ...value, generalRules: e.target.value })}
          placeholder="Размещая информацию на постере, придерживайся следующих общих правил…"
        />
      </div>

      <div>
        <Label className="text-xs">Конкретные правила (оформление отдельных элементов)</Label>
        <Textarea
          rows={5}
          value={value.specificRules}
          onChange={(e) => onChange({ ...value, specificRules: e.target.value })}
          placeholder="При оформлении отдельных элементов руководствуйся следующими принципами…"
        />
      </div>

      <div>
        <Label className="text-xs">Признаки стиля (передаются в подбор стиля)</Label>
        <Textarea
          rows={6}
          value={value.detectionFeatures ?? ""}
          onChange={(e) => onChange({ ...value, detectionFeatures: e.target.value })}
          placeholder="По каким признакам материала можно понять, что этот стиль подходит…"
        />
      </div>
    </div>
  );
}
