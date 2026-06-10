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
      <PopoverContent align="end" className="w-[520px] max-h-[80vh] overflow-auto text-sm">
        <h3 className="font-semibold mb-2">Режимы «Строгий» и «Вольный»</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Переключатель в левом верхнем углу. У каждого режима — свои промпты и свой
          набор стилей. Профили дизайна общие для обоих режимов.
        </p>

        <h3 className="font-semibold mb-2 mt-4">Как работает приложение</h3>
        <ol className="list-decimal list-inside text-xs space-y-1 mb-4">
          <li><b>Ввод</b> — вставить текст, загрузить файл (.txt / .md) или указать только тему.</li>
          <li><b>Анализ</b> — LLM превращает вход в структурированное содержание и выбирает рекомендуемый стиль.</li>
          <li><b>Дизайн-бриф</b> — на основе содержания, стиля и профиля дизайна модель создаёт wireframe и промпт для картинки.</li>
          <li><b>Изображение</b> — генерация финальной инфографики. Все промпты редактируются.</li>
        </ol>

        <h3 className="font-semibold mb-2 mt-4">Вспомогательные страницы</h3>
        <ul className="list-disc list-inside text-xs space-y-1 mb-4">
          <li><b>Стили (/styles)</b> — название, краткое описание, общие правила и конкретные правила для каждого стиля. Отдельные списки для строгого и вольного режимов.</li>
          <li><b>Профили дизайна (/design-profiles)</b> — фон страницы, яркие акценты, пастельные заливки, структурные цвета (выбор через палитру + HEX), типографический характер и режим выбора шрифта, свободные инструкции.</li>
          <li><b>Промпты (/prompts)</b> — все базовые промпты текущего режима.</li>
        </ul>

        <h3 className="font-semibold mb-2 mt-4">Где что лежит в проекте</h3>

        <Section title="Промпты текущего режима">
          <Row path="src/data/prompts/free/" desc="Промпты вольного режима (3 файла)" />
          <Row path="src/data/prompts/strict/" desc="Промпты строгого режима (3 файла)" />
          <p className="text-xs text-muted-foreground mt-1">
            Те же значения редактируются на странице <code>/prompts</code> и инлайн на главной.
          </p>
        </Section>

        <Section title="Стили инфографики">
          <Row path="src/data/default-styles.free.json" desc="Стили по умолчанию для вольного режима" />
          <Row path="src/data/default-styles.strict.json" desc="Стили по умолчанию для строгого режима" />
          <Row path="страница /styles" desc="Редактирование стилей и их правил" />
        </Section>

        <Section title="Профили дизайна">
          <Row path="src/data/default-design-profile.json" desc="Профиль по умолчанию («Дефолт стайл»)" />
          <Row path="src/data/typography-options.json" desc="Список типографических характеров и режимов выбора шрифта" />
          <Row path="страница /design-profiles" desc="Создание/редактирование профилей" />
        </Section>

        <Section title="Сборка промпта">
          <Row path="src/lib/prompt-injection.ts" desc="Преобразует стиль и профиль в текст для дизайн-брифа" />
        </Section>

        <Section title="Модели и API">
          <Row path="src/lib/models.ts" desc="Списки моделей Lovable AI Gateway" />
          <Row path="src/data/openrouter-models.json" desc="Список моделей OpenRouter (плейсхолдер)" />
          <Row path="src/lib/openrouter.ts" desc="Ключ OPENROUTER_API_KEY — вставить сюда" />
          <Row path="src/routes/api/llm.ts" desc="Серверный диспетчер текстовых LLM" />
          <Row path="src/routes/api/generate-image.ts" desc="Серверный роут генерации изображения" />
        </Section>

        <Section title="Состояние">
          <Row path="src/store/useSettingsStore.ts" desc="Режим, промпты по режимам, стили по режимам, профили" />
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
