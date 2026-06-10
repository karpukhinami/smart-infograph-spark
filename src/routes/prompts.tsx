import { createFileRoute } from "@tanstack/react-router";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSettingsStore, useCurrentPrompts } from "@/store/useSettingsStore";

export const Route = createFileRoute("/prompts")({
  head: () => ({ meta: [{ title: "Промпты — AI Infographic Generator" }] }),
  component: PromptsPage,
});

function PromptsPage() {
  const mode = useSettingsStore((s) => s.mode);
  const prompts = useCurrentPrompts();
  const setPrompt = useSettingsStore((s) => s.setPrompt);
  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6">
      <h1 className="text-lg font-semibold">
        Базовые промпты — режим «{mode === "free" ? "вольный" : "строгий"}»
      </h1>
      <p className="text-xs text-muted-foreground">
        Промпты хранятся отдельно для каждого режима. Изменения сохраняются на текущую сессию.
      </p>
      <Block
        label="Промпт анализа — с исходным текстом"
        value={prompts.analysisWithContent}
        onChange={(v) => setPrompt("analysisWithContent", v)}
      />
      <Block
        label="Промпт анализа — только тема"
        value={prompts.analysisTopicOnly}
        onChange={(v) => setPrompt("analysisTopicOnly", v)}
      />
      <Block
        label="Промпт дизайн-брифа (этап 3)"
        value={prompts.designBrief}
        onChange={(v) => setPrompt("designBrief", v)}
      />
      <Block
        label="Общие правила финального изображения"
        value={prompts.generalRules}
        onChange={(v) => setPrompt("generalRules", v)}
      />
    </div>
  );
}

function Block({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Textarea rows={16} className="font-mono text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
