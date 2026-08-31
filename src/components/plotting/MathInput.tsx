import { useMemo } from "react";
import katex from "katex";
import { HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { equationLatex, expressionLatex } from "@/lib/plotting/math-expr";

export function MathSyntaxHint() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground">
          <HelpCircle className="size-4" />
          <span className="sr-only">Подсказка по записи формул</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 text-xs leading-relaxed">
        <p className="mb-2 font-medium text-sm">Как писать формулы</p>
        <ul className="space-y-1">
          <li>Степень: <code>x^2</code>, <code>x^(1/3)</code></li>
          <li>Корень: <code>sqrt(x)</code></li>
          <li>Дробь: <code>(x+1)/(x-2)</code></li>
          <li>Скобки: <code>2(x+1)(x-3)</code></li>
          <li>π: <code>pi</code>, <code>pi/2</code>, <code>2pi</code></li>
          <li>Тригонометрия: <code>sin(x)</code>, <code>cos(2x)</code>, <code>tan(x)</code></li>
          <li>Логарифм: <code>ln(x)</code>, <code>log(x, 10)</code></li>
          <li>Модуль: <code>abs(x)</code></li>
          <li>Умножение можно не писать: <code>3t</code>, <code>2sin(x)</code></li>
          <li>Можно вставить LaTeX: <code>{"\\frac{x+1}{x-2}"}</code></li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  placeholder?: string;
  prefix?: string;
  /** Разбирать как уравнение с одним знаком «=». */
  equation?: boolean;
  label?: string;
  showHint?: boolean;
  className?: string;
}

export function MathInput({
  value,
  onChange,
  variables = [],
  placeholder,
  prefix,
  equation = false,
  label,
  showHint = true,
}: MathInputProps) {
  const preview = useMemo(() => {
    const text = value.trim();
    if (!text) return { html: "", error: "" };
    try {
      const latex = equation ? equationLatex(text, variables) : expressionLatex(text, variables);
      const full = prefix ? `${prefix} ${latex}` : latex;
      return { html: katex.renderToString(full, { throwOnError: false, displayMode: false }), error: "" };
    } catch (error) {
      return { html: "", error: (error as Error).message };
    }
  }, [value, variables, equation, prefix]);

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-2">
        {prefix && <span className="shrink-0 font-medium italic">{prefix}</span>}
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="font-mono text-sm"
        />
        {showHint && <MathSyntaxHint />}
      </div>
      {value.trim() &&
        (preview.error ? (
          <p className="text-xs text-destructive">{preview.error}</p>
        ) : (
          <div
            className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-sm"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        ))}
    </div>
  );
}
