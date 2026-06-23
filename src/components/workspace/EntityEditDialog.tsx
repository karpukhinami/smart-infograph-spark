import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { AnalysisAttention, AnalysisEntity, AnalysisSectionId } from "@/lib/types";

interface Props {
  open: boolean;
  entity: AnalysisEntity | null;
  isNew?: boolean;
  onClose: () => void;
  onSave: (patch: Partial<AnalysisEntity>) => void;
}

function asText(v: string | string[] | null | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? v.join("\n") : String(v);
}

function fromText(t: string): string | string[] | null {
  const nonEmpty = t.split("\n").filter((l) => l.trim() !== "");
  if (nonEmpty.length === 0) return null;
  if (nonEmpty.length === 1) return nonEmpty[0];
  return nonEmpty;
}

function checkBalance(text: string): string | null {
  if (!text) return null;
  const cleaned = text.replace(/\\\$/g, "");
  const doubleDollarCount = (cleaned.match(/\$\$/g) ?? []).length;
  if (doubleDollarCount % 2 !== 0) return "Несбалансированные $$ (LaTeX-блок)";
  const withoutDouble = cleaned.replace(/\$\$/g, "");
  const singleDollar = (withoutDouble.match(/\$/g) ?? []).length;
  if (singleDollar % 2 !== 0) return "Несбалансированные $ (LaTeX-формула)";
  const backticks = (cleaned.match(/`/g) ?? []).length;
  if (backticks % 2 !== 0) return "Несбалансированные ` (код)";
  return null;
}

const SECTION_OPTIONS: { value: AnalysisSectionId; label: string }[] = [
  { value: "prerequisites", label: "Предпосылки" },
  { value: "main", label: "Основное содержание" },
  { value: "additions", label: "Выводы и дополнения" },
];

function InfoIcon({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" tabIndex={-1} className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function EntityEditDialog({ open, entity, isNew = false, onClose, onSave }: Props) {
  const [sectionId, setSectionId] = useState<AnalysisSectionId | "">("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [formula, setFormula] = useState("");
  const [addendum, setAddendum] = useState("");
  const [attention, setAttention] = useState<AnalysisAttention>("normal");
  const [icon, setIcon] = useState("");
  const [visualDescription, setVisualDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!entity) {
      setSectionId("");
      setTitle("");
      setContent("");
      setFormula("");
      setAddendum("");
      setAttention("normal");
      setIcon("");
      setVisualDescription("");
      return;
    }
    setSectionId(entity.sectionId ?? "");
    setTitle(entity.title ?? "");
    setContent(asText(entity.content));
    setFormula(asText(entity.formula));
    setAddendum(asText(entity.cardAddendum));
    const att = String(entity.attention ?? "normal").toLowerCase();
    setAttention(att === "main" ? "core" : (att as AnalysisAttention));
    setIcon(entity.icon ?? "");
    setVisualDescription(entity.visual?.description ?? "");
  }, [entity, open]);

  const validationError = useMemo(() => {
    for (const [label, t] of [
      ["Заголовок", title],
      ["Контент", content],
      ["Формула", formula],
      ["Дополнение", addendum],
      ["Иконка", icon],
      ["Картинка", visualDescription],
    ] as const) {
      const err = checkBalance(t);
      if (err) return `${label}: ${err}`;
    }
    return null;
  }, [title, content, formula, addendum, icon, visualDescription]);

  const contentEmpty = content.trim() === "";
  const titleEmpty = title.trim() === "";
  const sectionEmpty = sectionId === "";
  const canSave = !contentEmpty && !validationError && !sectionEmpty && (!isNew || !titleEmpty);

  const handleSave = () => {
    if (!canSave) return;
    const visDescT = visualDescription.trim();
    const visual = visDescT === "" ? null : { type: null, description: visDescT };
    onSave({
      sectionId: sectionId as AnalysisSectionId,
      title: titleEmpty ? null : title,
      content: fromText(content),
      formula: fromText(formula),
      cardAddendum: fromText(addendum),
      attention,
      icon: icon.trim() === "" ? null : icon.trim(),
      visual,
      // for new entities, give a sensible default entityType
      ...(isNew ? { entityType: "custom" } : {}),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Новая карточка" : "Редактировать карточку"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="ent-section">
                Раздел <span className="text-destructive">*</span>
              </Label>
              <InfoIcon text="Этот параметр повлияет на расположение карточки на инфографике: предпосылки размещаются в верхней части изображения, основное содержание — в центральной, а выводы и дополнения — внизу." />
            </div>
            <Select value={sectionId} onValueChange={(v) => setSectionId(v as AnalysisSectionId)}>
              <SelectTrigger id="ent-section" className={sectionEmpty ? "border-destructive" : ""}>
                <SelectValue placeholder="Выберите раздел" />
              </SelectTrigger>
              <SelectContent>
                {SECTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ent-title">
              Заголовок{isNew && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id="ent-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={isNew && titleEmpty ? "border-destructive" : ""}
            />
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

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="ent-icon">Иконка</Label>
              <InfoIcon text="Используйте для описания короткую фразу" />
            </div>
            <Input
              id="ent-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Например: lightbulb или эмодзи"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="ent-visual-desc">Описание картинки</Label>
              <InfoIcon text="Опишите пожелания к иллюстрации карточки: чем подробнее — тем лучше" />
            </div>
            <Textarea
              id="ent-visual-desc"
              value={visualDescription}
              onChange={(e) => setVisualDescription(e.target.value)}
              rows={3}
            />
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
