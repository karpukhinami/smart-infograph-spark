import { useMemo } from "react";
import katex from "katex";
import { expressionLatex } from "@/lib/plotting/math-expr";
import { cn } from "@/lib/utils";

/** Инлайновый KaTeX-фрагмент. Никогда не падает. */
export function MathLatex({ latex, className }: { latex: string; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { throwOnError: false, displayMode: false });
    } catch {
      return "";
    }
  }, [latex]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Облачко с математическим видом введённого значения.
 * Показывается только когда ввод не является простым числом.
 */
export function ValueFormula({
  value,
  variables = [],
  prefix,
  className,
}: {
  value: string;
  variables?: string[];
  prefix?: string;
  className?: string;
}) {
  const text = String(value ?? "").trim();
  const plain = !text || /^[-−]?\d+([.,]\d+)?$/.test(text);
  const result = useMemo(() => {
    if (plain) return null;
    try {
      const latex = expressionLatex(text, variables);
      return { latex: prefix ? `${prefix} ${latex}` : latex, error: null as string | null };
    } catch (error) {
      return { latex: "", error: (error as Error).message };
    }
  }, [plain, text, variables, prefix]);

  if (!result) return null;
  if (result.error) return <p className={cn("text-xs text-destructive", className)}>{result.error}</p>;
  return (
    <div
      className={cn(
        "w-fit rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs leading-tight",
        className,
      )}
    >
      <MathLatex latex={result.latex} />
    </div>
  );
}
