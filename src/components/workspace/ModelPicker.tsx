import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEXT_MODELS, IMAGE_MODELS } from "@/lib/models";

export function ModelPicker({
  kind,
  value,
  onChange,
}: {
  kind: "text" | "image";
  value: string;
  onChange: (v: string) => void;
}) {
  const list = kind === "text" ? TEXT_MODELS : IMAGE_MODELS;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[260px]">
        <SelectValue placeholder="Model" />
      </SelectTrigger>
      <SelectContent>
        {list.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
