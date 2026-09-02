import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface PlotBeautifyDialogProps {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onDraw: (wishes: string) => void;
}

export function PlotBeautifyDialog({ open, busy, onOpenChange, onDraw }: PlotBeautifyDialogProps) {
  const [wishes, setWishes] = useState("");

  useEffect(() => {
    if (open) setWishes("");
  }, [open]);

  const canDraw = wishes.trim().length > 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Сделать красиво</DialogTitle>
          <DialogDescription>
            Текущий чертёж будет отправлен модели как образец. Опишите, что добавить к рисунку — фон,
            иллюстрацию, стиль. Математические элементы должны сохраниться.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={5}
          value={wishes}
          onChange={(e) => setWishes(e.target.value)}
          placeholder="Например: лесная поляна, мягкий акварельный фон, школьная тетрадь по краям…"
          disabled={busy}
          autoFocus
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Отмена
          </Button>
          <Button type="button" disabled={!canDraw} onClick={() => onDraw(wishes.trim())}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Рисую…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Нарисовать
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
