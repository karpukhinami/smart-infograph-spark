import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface HeaderValues {
  topic: string;
  subject: string | null;
  grade: string | null;
  summary: string;
}

interface Props {
  open: boolean;
  value: HeaderValues | null;
  onClose: () => void;
  onSave: (patch: HeaderValues) => void;
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.filter((x) => x != null).map((x) => String(x)).join("\n");
  return String(v);
}

function checkBalance(input: unknown): string | null {
  const text = asText(input);
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

// Treat "Другое" as empty for editing/display
function displayValue(v: unknown): string {
  const s = asText(v);
  return s.trim().toLowerCase() === "другое" ? "" : s;
}

export function HeaderEditDialog({ open, value, onClose, onSave }: Props) {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (!value) return;
    setTopic(asText(value.topic));
    setSubject(displayValue(value.subject));
    setGrade(displayValue(value.grade));
    setSummary(asText(value.summary));
  }, [value]);

  const validationError = useMemo(() => {
    for (const [label, t] of [
      ["Заголовок", topic],
      ["Предмет", subject],
      ["Класс", grade],
      ["Краткое содержание", summary],
    ] as const) {
      const err = checkBalance(t);
      if (err) return `${label}: ${err}`;
    }
    return null;
  }, [topic, subject, grade, summary]);

  const topicEmpty = topic.trim() === "";
  const canSave = !topicEmpty && !validationError;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      topic: topic.trim(),
      subject: subject.trim() === "" ? null : subject.trim(),
      grade: grade.trim() === "" ? null : grade.trim(),
      summary: summary,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактировать шапку</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hdr-topic">
              Заголовок <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hdr-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={topicEmpty ? "border-destructive" : ""}
            />
            {topicEmpty && (
              <p className="text-xs text-destructive">Заголовок не может быть пустым</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hdr-subject">Предмет</Label>
              <Input id="hdr-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hdr-grade">Класс</Label>
              <Input id="hdr-grade" value={grade} onChange={(e) => setGrade(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hdr-summary">Краткое содержание</Label>
            <Textarea
              id="hdr-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
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
          <Button variant="outline" onClick={onClose}>Отменить</Button>
          <Button onClick={handleSave} disabled={!canSave}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
