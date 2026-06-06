import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function PromptDisclosure({
  label,
  value,
  onChange,
  rightSlot,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rightSlot?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between p-2">
        <Button variant="ghost" size="sm" onClick={() => { setDraft(value); setOpen(!open); }}>
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          {label}
        </Button>
        <div>{rightSlot}</div>
      </div>
      {open && (
        <div className="p-2 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onChange(draft); }}>Сохранить</Button>
            <Button size="sm" variant="outline" onClick={() => setDraft(value)}>Отменить</Button>
          </div>
        </div>
      )}
    </div>
  );
}
