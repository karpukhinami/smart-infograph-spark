import { useEffect, useState } from "react";
import type { AnalysisEntity } from "@/lib/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { generateCardVisualImage } from "@/lib/workspace/card-visual-prompt";

interface Props {
  open: boolean;
  entity: AnalysisEntity | null;
  entityIndex: number | null;
  imageModel: string;
  onClose: () => void;
  onSave: (index: number, visual: NonNullable<AnalysisEntity["visual"]> | null) => void;
}

export function EntityVisualDialog({
  open,
  entity,
  entityIndex,
  imageModel,
  onClose,
  onSave,
}: Props) {
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !entity) return;
    setDescription(entity.visual?.description ?? "");
    setPreviewUrl(entity.visual?.generatedImage ?? null);
    setError(null);
  }, [open, entity]);

  const hasDescription = description.trim().length > 0;
  const hasImage = Boolean(previewUrl);

  function buildVisual(): NonNullable<AnalysisEntity["visual"]> | null {
    const desc = description.trim();
    if (!desc) return null;
    return {
      type: entity?.visual?.type ?? null,
      description: desc,
      generatedImage: previewUrl,
    };
  }

  function handleClose() {
    if (entityIndex !== null) {
      const next = buildVisual();
      const prevDesc = entity?.visual?.description?.trim() ?? "";
      const prevImg = entity?.visual?.generatedImage ?? null;
      if (next?.description !== prevDesc || (next?.generatedImage ?? null) !== prevImg) {
        onSave(entityIndex, next);
      }
    }
    onClose();
  }

  async function handleGenerate() {
    if (entityIndex === null || !hasDescription) return;
    try {
      setGenerating(true);
      setError(null);
      const dataUrl = await generateCardVisualImage(description, imageModel);
      setPreviewUrl(dataUrl);
      onSave(entityIndex, {
        type: entity?.visual?.type ?? null,
        description: description.trim(),
        generatedImage: dataUrl,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Не удалось сгенерировать изображение");
    } finally {
      setGenerating(false);
    }
  }

  const title = entity?.title?.trim() || "Визуал карточки";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="entity-visual-desc">Описание визуала</Label>
            <Textarea
              id="entity-visual-desc"
              rows={12}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание изображения для карточки…"
              className="text-sm min-h-[280px] resize-y"
            />
          </div>

          <div className="space-y-2">
            <Label>Превью</Label>
            <div className="aspect-square w-full rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground px-4 text-center">
                  {hasDescription ? "Нажмите «Сгенерировать»" : "Заполните описание слева"}
                </span>
              )}
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleClose} disabled={generating}>
            Закрыть
          </Button>
          <Button type="button" onClick={handleGenerate} disabled={!hasDescription || generating}>
            {generating ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
            {hasImage ? "Перегенерировать" : "Сгенерировать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
