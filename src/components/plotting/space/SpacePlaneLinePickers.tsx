import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lineChoices } from "@/lib/plotting/space/scene";
import type { SpaceSceneData } from "@/lib/plotting/space/types";

type Props = {
  space3d: SpaceSceneData;
  lineAId: string;
  lineBId: string;
  onLineA: (id: string) => void;
  onLineB: (id: string) => void;
  labelA?: string;
  labelB?: string;
};

export function SpacePlaneLinePickers({
  space3d,
  lineAId,
  lineBId,
  onLineA,
  onLineB,
  labelA = "Прямая 1",
  labelB = "Прямая 2",
}: Props) {
  const choices = lineChoices(space3d);

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{labelA}</Label>
        <Select value={lineAId} onValueChange={onLineA}>
          <SelectTrigger className="h-8 bg-background text-xs">
            <SelectValue placeholder={labelA} />
          </SelectTrigger>
          <SelectContent>
            {choices.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{labelB}</Label>
        <Select value={lineBId} onValueChange={onLineB}>
          <SelectTrigger className="h-8 bg-background text-xs">
            <SelectValue placeholder={labelB} />
          </SelectTrigger>
          <SelectContent>
            {choices.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
