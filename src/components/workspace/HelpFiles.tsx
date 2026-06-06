import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function HelpFiles() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <HelpCircle className="size-4" />
          Памятка
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[440px] max-h-[70vh] overflow-auto text-sm">
        <h3 className="font-semibold mb-2">Где что лежит в проекте</h3>

        <Section title="Базовые промпты (текст)">
          <Row path="src/data/prompts/analysis-with-content.txt" desc="Промпт анализа, когда подан исходный текст" />
          <Row path="src/data/prompts/analysis-topic-only.txt" desc="Промпт анализа, когда указана только тема" />
          <Row path="src/data/prompts/design-brief.txt" desc="Промпт для создания дизайн-брифа и wireframe" />
          <p className="text-xs text-muted-foreground mt-1">
            Эти же промпты можно править в сессии на странице{" "}
            <code>/prompts</code> и инлайн через «Show prompt» на главной.
          </p>
        </Section>

        <Section title="Стили инфографики">
          <Row path="src/data/default-styles.json" desc="Список стилей по умолчанию (id, имя, описание, правила)" />
          <Row path="страница /styles" desc="Редактирование стилей и общих правил формирования инфографики" />
        </Section>

        <Section title="Профили дизайна (цвета и шрифты)">
          <Row path="src/data/default-design-profile.json" desc="Профиль по умолчанию (DefaultBentoStyle)" />
          <Row path="src/data/design-options.ts" desc="Палитра цветов и список шрифтов, доступных в выпадашках" />
          <Row path="страница /design-profiles" desc="Создание/редактирование профилей" />
        </Section>

        <Section title="Модели и API">
          <Row path="src/lib/models.ts" desc="Списки моделей Lovable AI Gateway" />
          <Row path="src/data/openrouter-models.json" desc="Список моделей OpenRouter (плейсхолдер)" />
          <Row path="src/lib/openrouter.ts" desc="Ключ OPENROUTER_API_KEY — вставить сюда" />
          <Row path="src/routes/api/llm.ts" desc="Серверный диспетчер текстовых LLM" />
          <Row path="src/routes/api/generate-image.ts" desc="Серверный роут генерации изображения" />
        </Section>

        <Section title="Состояние">
          <Row path="src/store/useSettingsStore.ts" desc="Промпты, стили, профили, общие правила (sessionStorage)" />
          <Row path="src/store/useProjectStore.ts" desc="Этапы пайплайна и версии результатов" />
        </Section>
      </PopoverContent>
    </Popover>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ path, desc }: { path: string; desc: string }) {
  return (
    <div className="text-xs">
      <code className="bg-muted px-1 py-0.5 rounded">{path}</code>
      <span className="text-muted-foreground"> — {desc}</span>
    </div>
  );
}
