import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { AnalysisAttention, AnalysisEntity } from "@/lib/types";

interface Props {
  open: boolean;
  entity: AnalysisEntity | null;
  onClose: () => void;
  onSave: (patch: Partial<AnalysisEntity>) => void;
}

function asText(v: string | string[] | null | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? v.join("\n") : String(v);
}

function fromText(t: string): string | string[] | null {
  const lines = t.split("\n").map((l) => l).filter((l, _, all) => true);
  // Trim trailing empty lines
  const nonEmpty = t.split("\n").filter((l) => l.trim() !== "");
  if (nonEmpty.length === 0) return null;
  if (nonEmpty.length === 1) return nonEmpty[0];
  return nonEmpty;
}

// Validate that LaTeX `$...$` delimiters and common markdown markers are balanced.
function checkBalance(text: string): string | null {
  if (!text) return null;
  // Strip escaped \$ before counting
  const cleaned = text.replace(/\\\$/g, "");
  // Count $$ pairs first, then single $
  const doubleDollarCount = (cleaned.match(/\$\$/g) ?? []).length;
  if (doubleDollarCount % 2 !== 0) return "Несбалансированные $$ (LaTeX-блок)";
  const withoutDouble = cleaned.replace(/\$\$/g, "");
  const singleDollar = (withoutDouble.match(/\$/g) ?? []).length;
  if (singleDollar % 2 !== 0) return "Несбалансированные $ (LaTeX-формула)";
  // Backticks
  const backticks = (cleaned.match(/`/g) ?? []).length;
  if (backticks % 2 !== 0) return "Несбалансированные ` (код)";
  return null;
}

export function EntityEditDialog({ open, entity, onClose, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [formula, setFormula] = useState("");
  const [addendum, setAddendum] = useState("");
  const [attention, setAttention] = useState<AnalysisAttention>("normal");

  useEffect(() => {
    if (!entity) return;
    setTitle(entity.title ?? "");
    setContent(asText(entity.content));
    setFormula(asText(entity.formula));
    setAddendum(asText(entity.cardAddendum));
    const att = String(entity.attention ?? "normal").toLowerCase();
    setAttention(att === "main" ? "core" : (att as AnalysisAttention));
  }, [entity]);

  const validationError = useMemo(() => {
    for (const [label, t] of [
      ["Заголовок", title],
      ["Контент", content],
      ["Формула", formula],
      ["Дополнение", addendum],
    ] as const) {
      const err = checkBalance(t);
      if (err) return `${label}: ${err}`;
    }
    return null;
  }, [title, content, formula, addendum]);

  const contentEmpty = content.trim() === "";
  const canSave = !contentEmpty && !validationError;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      title: title.trim() === "" ? null : title,
      content: fromText(content),
      formula: fromText(formula),
      cardAddendum: fromText(addendum),
      attention,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактировать карточку</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ent-title">Заголовок</Label>
            <Input id="ent-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ent-content">
              Основное содержание <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="ent-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className={contentEmpty ? "border-destructive" : ""}
            />
            {contentEmpty && (
              <p className="text-xs text-destructive">Основное содержание не может быть пустым</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ent-formula">Формула (каждая на новой строке)</Label>
            <Textarea
              id="ent-formula"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              rows={2}
              placeholder="Например: E = mc^2"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ent-addendum">Дополнение</Label>
            <Textarea
              id="ent-addendum"
              value={addendum}
              onChange={(e) => setAddendum(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Цвет карточки</Label>
            <RadioGroup
              value={attention}
              onValueChange={(v) => setAttention(v as AnalysisAttention)}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="core" id="att-core" />
                <Label htmlFor="att-core" className="font-normal cursor-pointer">Главный цвет</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="normal" id="att-normal" />
                <Label htmlFor="att-normal" className="font-normal cursor-pointer">Пастель</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="accent" id="att-accent" />
                <Label htmlFor="att-accent" className="font-normal cursor-pointer">Контрастная пастель</Label>
              </div>
            </RadioGroup>
          </div>

          {validationError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {validationError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={!canSave}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
