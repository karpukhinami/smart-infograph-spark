import { createFileRoute } from "@tanstack/react-router";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/store/useSettingsStore";

export const Route = createFileRoute("/prompts")({
  head: () => ({ meta: [{ title: "Промпты — AI Infographic Generator" }] }),
  component: PromptsPage,
});

function PromptsPage() {
  const prompts = useSettingsStore((s) => s.prompts);
  const setPrompt = useSettingsStore((s) => s.setPrompt);
  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6">
      <h1 className="text-lg font-semibold">Базовые промпты</h1>
      <p className="text-xs text-muted-foreground">
        Изменения сохраняются на текущую сессию. Те же значения редактируются и через раскрывашки на главной странице.
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
