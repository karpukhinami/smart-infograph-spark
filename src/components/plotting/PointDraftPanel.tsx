import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MathLatex } from "./MathLatex";
import { ValueFormula } from "./MathLatex";
import { usePlotStore } from "@/lib/plotting/store";
import { sceneAnchorChoices } from "@/lib/plotting/scene";
import { graphInlineLatex } from "@/lib/plotting/latex";
import type { PointMode } from "@/lib/plotting/types";

/**
 * Плашка добавления точки: выбор способа задания живёт здесь, а не внутри
 * карточки точки, поэтому один расчёт может дать сразу несколько карточек.
 */
export function PointDraftPanel() {
  const scene = usePlotStore((state) => state.scene);
  const draft = usePlotStore((state) => state.pointDraft);
  const error = usePlotStore((state) => state.pointDraftError);
  const update = usePlotStore((state) => state.updatePointDraft);
  const cancel = usePlotStore((state) => state.cancelPointDraft);
  const commit = usePlotStore((state) => state.commitPointDraft);

  if (!draft) return null;

  const xName = scene.xAxis.name.trim() || "x";
  const yName = scene.yAxis.name.trim() || "y";
  const anchors = sceneAnchorChoices(scene);

  const modes: Array<{ value: PointMode; label: string; disabled?: boolean }> = [
    { value: "plane", label: "на плоскости" },
    { value: "onGraph", label: "на графике", disabled: scene.graphs.length === 0 },
    { value: "intersection", label: "на пересечении", disabled: scene.graphs.length < 2 },
    { value: "anchor", label: "выбрать из опорных точек", disabled: anchors.length === 0 },
  ];

  const graphItems = scene.graphs.map((graph) => (
    <SelectItem key={graph.id} value={graph.id}>
      <span className="flex items-center gap-2">
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: graph.style.color }}
        />
        <MathLatex latex={graphInlineLatex(graph, xName, yName)} />
      </span>
    </SelectItem>
  ));

  const selectedGraph = scene.graphs.find((graph) => graph.id === draft.graphId);
  const selectedGraphB = scene.graphs.find((graph) => graph.id === draft.graphIdB);

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Как задаётся точка</Label>
        <Select
          value={draft.mode}
          onValueChange={(value) =>
            update({ mode: value as PointMode, graphId: null, graphIdB: null, anchorIndex: null })
          }
        >
          <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            {modes.map((mode) => (
              <SelectItem key={mode.value} value={mode.value} disabled={mode.disabled}>
                {mode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {draft.mode === "plane" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{xName}</Label>
            <Input
              value={draft.x}
              placeholder="например pi/2"
              className="bg-background font-mono text-xs"
              onChange={(event) => update({ x: event.target.value })}
            />
            <ValueFormula value={draft.x} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{yName}</Label>
            <Input
              value={draft.y}
              placeholder="например sqrt(2)"
              className="bg-background font-mono text-xs"
              onChange={(event) => update({ y: event.target.value })}
            />
            <ValueFormula value={draft.y} />
          </div>
        </div>
      )}

      {draft.mode === "onGraph" && (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">График</Label>
            <Select value={draft.graphId ?? ""} onValueChange={(value) => update({ graphId: value })}>
              <SelectTrigger className="bg-background">
                {selectedGraph ? (
                  <MathLatex latex={graphInlineLatex(selectedGraph, xName, yName)} />
                ) : (
                  <span className="text-muted-foreground">выберите график</span>
                )}
              </SelectTrigger>
              <SelectContent>{graphItems}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{xName}</Label>
            <Input
              value={draft.x}
              placeholder="например 1,5"
              className="bg-background font-mono text-xs"
              onChange={(event) => update({ x: event.target.value })}
            />
            <ValueFormula value={draft.x} />
          </div>
        </div>
      )}

      {draft.mode === "intersection" && (
        <div className="grid grid-cols-2 gap-2">
          {([
            ["graphId", "Первый график", selectedGraph],
            ["graphIdB", "Второй график", selectedGraphB],
          ] as const).map(([key, title, current]) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{title}</Label>
              <Select
                value={draft[key] ?? ""}
                onValueChange={(value) => update({ [key]: value })}
              >
                <SelectTrigger className="bg-background">
                  {current ? (
                    <MathLatex latex={graphInlineLatex(current, xName, yName)} />
                  ) : (
                    <span className="text-muted-foreground">выберите</span>
                  )}
                </SelectTrigger>
                <SelectContent>{graphItems}</SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      {draft.mode === "anchor" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Опорная точка</Label>
          <Select
            value={draft.anchorIndex === null || !draft.graphId ? "" : `${draft.graphId}:${draft.anchorIndex}`}
            onValueChange={(value) => {
              const [graphId, index] = value.split(":");
              update({ graphId, anchorIndex: Number(index) });
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="все опорные точки показаны на чертеже" />
            </SelectTrigger>
            <SelectContent>
              {anchors.map((anchor) => (
                <SelectItem
                  key={`${anchor.graphId}:${anchor.anchorIndex}`}
                  value={`${anchor.graphId}:${anchor.anchorIndex}`}
                >
                  {`Функция ${anchor.graphIndex}: (${anchor.displayX}; ${anchor.displayY})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Пока выбор не сделан, на чертеже видны все опорные точки.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" size="sm" className="flex-1" onClick={commit}>
          Отметить
        </Button>
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={cancel}>
          Отменить
        </Button>
      </div>
    </div>
  );
}
