import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X, GripVertical } from "lucide-react";

export interface RefineDialogProps {
  open: boolean;
  title: string;
  description: string;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}

export function RefineDialog({ open, title, description, busy, onCancel, onSubmit }: RefineDialogProps) {
  const [text, setText] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== "undefined" ? Math.max(20, window.innerWidth / 2 - 260) : 200,
    y: 120,
  }));
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (open) setText("");
  }, [open]);

  function startDrag(e: React.MouseEvent) {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    function move(ev: MouseEvent) {
      if (!drag.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - 100, ev.clientX - drag.current.dx));
      const y = Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - drag.current.dy));
      setPos({ x, y });
    }

    function up() {
      drag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  if (!open) return null;
  return (
    <div
      className="fixed z-50 w-[520px] max-w-[92vw] rounded-lg border border-border bg-card shadow-2xl"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="flex items-center justify-between gap-2 p-2 border-b border-border cursor-move select-none bg-muted/40 rounded-t-lg"
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GripVertical className="size-4 opacity-50" />
          {title}
        </div>
        <Button size="icon" variant="ghost" onClick={onCancel} disabled={busy}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-xs text-muted-foreground whitespace-pre-line">{description}</p>
        <Textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          placeholder="Опишите желаемые изменения…"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={() => onSubmit(text)} disabled={busy || !text.trim()}>
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            Отправить на перегенерацию
          </Button>
        </div>
      </div>
    </div>
  );
}
