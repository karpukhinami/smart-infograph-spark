import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BipolarSwitch, poleLabelClass } from "@/components/workspace/BipolarSwitch";
import {
  EMPTY_FEEDBACK_AXES,
  type BipolarFeedbackValue,
  type ImageFeedbackRating,
  type SimpleImageFeedbackDetail,
} from "@/lib/image-feedback-types";

interface AxisRowProps {
  topic: string;
  leftLabel: string;
  rightLabel: string;
  value: BipolarFeedbackValue;
  onChange: (v: "left" | "right") => void;
}

function AxisRow({ topic, leftLabel, rightLabel, value, onChange }: AxisRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{topic}</div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button
          type="button"
          className={poleLabelClass(value === "left")}
          onClick={() => onChange("left")}
        >
          {leftLabel}
        </button>
        <BipolarSwitch
          value={value}
          onChange={onChange}
          ariaLabel={`${topic}: ${leftLabel} или ${rightLabel}`}
        />
        <button
          type="button"
          className={poleLabelClass(value === "right")}
          onClick={() => onChange("right")}
        >
          {rightLabel}
        </button>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  rating: ImageFeedbackRating;
  showIllustrationsRow: boolean;
  onSkip: () => void;
  onSubmit: (detail: SimpleImageFeedbackDetail) => void;
}

export function ImageFeedbackModal({
  open,
  rating,
  showIllustrationsRow,
  onSkip,
  onSubmit,
}: Props) {
  const [axes, setAxes] = useState({ ...EMPTY_FEEDBACK_AXES });
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) {
      setAxes({ ...EMPTY_FEEDBACK_AXES });
      setComment("");
    }
  }, [open]);

  const setAxis = (key: keyof typeof EMPTY_FEEDBACK_AXES, v: "left" | "right") => {
    setAxes((prev) => ({ ...prev, [key]: v }));
  };

  const intro =
    rating === "dislike"
      ? "Жаль, что результат не понравился. Если укажете, что именно — будет проще улучшить генерацию. Все пункты необязательны."
      : "Спасибо за оценку! Пара уточнений поможет сделать сервис лучше. Все пункты необязательны.";

  const handleSubmit = () => {
    const detail: SimpleImageFeedbackDetail = {
      rating,
      colors: axes.colors,
      composition: axes.composition,
      extraElements: axes.extraElements,
      text: axes.text,
      comment: comment.trim(),
      submittedAt: Date.now(),
    };
    if (showIllustrationsRow) {
      detail.illustrations = axes.illustrations;
    }
    onSubmit(detail);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onSkip();
      }}
    >
      <DialogContent className="max-w-md gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Обратная связь</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">{intro}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[min(52vh,420px)] overflow-y-auto pr-1">
          <AxisRow
            topic="Цвета"
            leftLabel="понравились"
            rightLabel="не понравились"
            value={axes.colors}
            onChange={(v) => setAxis("colors", v)}
          />
          <AxisRow
            topic="Композиция"
            leftLabel="корректна"
            rightLabel="некорректна"
            value={axes.composition}
            onChange={(v) => setAxis("composition", v)}
          />
          <AxisRow
            topic="Посторонние элементы"
            leftLabel="отсутствуют"
            rightLabel="присутствуют"
            value={axes.extraElements}
            onChange={(v) => setAxis("extraElements", v)}
          />
          <AxisRow
            topic="Текст"
            leftLabel="без ошибок"
            rightLabel="с ошибками"
            value={axes.text}
            onChange={(v) => setAxis("text", v)}
          />
          {showIllustrationsRow && (
            <AxisRow
              topic="Иллюстрации"
              leftLabel="подходят"
              rightLabel="не подходят"
              value={axes.illustrations}
              onChange={(v) => setAxis("illustrations", v)}
            />
          )}

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="image-feedback-comment" className="text-xs">
              Комментарий (опционально)
            </Label>
            <Textarea
              id="image-feedback-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Что ещё стоит учесть…"
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onSkip}>
            Пропустить
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Отправить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
