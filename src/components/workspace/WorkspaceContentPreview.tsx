import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import type { AnalysisEntity, AnalysisJson, DesignProfile } from "@/lib/types";
import { SimpleContentPreview } from "@/components/workspace/SimpleContentPreview";
import { EntityVisualDialog } from "@/components/workspace/EntityVisualDialog";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/useProjectStore";
import { generateCardVisualImage } from "@/lib/workspace/card-visual-prompt";

interface Props {
  analysis: AnalysisJson;
  profile: DesignProfile | null;
  imageModel: string;
}

function visualDescription(entity: AnalysisEntity): string {
  return entity.visual?.description?.trim() ?? "";
}

function hasGeneratedVisual(entity: AnalysisEntity): boolean {
  return Boolean(entity.visual?.generatedImage);
}

export function WorkspaceContentPreview({ analysis, profile, imageModel }: Props) {
  const entities = analysis.entities ?? [];
  const updateEntity = useProjectStore((s) => s.updateActiveAnalysisEntity);

  const [visualDialogIndex, setVisualDialogIndex] = useState<number | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);

  const pendingIndices = useMemo(
    () =>
      entities
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => visualDescription(e) && !hasGeneratedVisual(e))
        .map(({ i }) => i),
    [entities],
  );

  const renderVisualIcon = useCallback(
    (index: number, entity: AnalysisEntity) => {
      const desc = visualDescription(entity);
      const generated = hasGeneratedVisual(entity);
      const busy = generatingIndex === index || (generatingAll && pendingIndices.includes(index));

      let className =
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ";
      if (generated) {
        className += "border border-gray-300 bg-white text-[#c084fc] hover:bg-[#faf5ff]";
      } else if (desc) {
        className += "text-gray-500 hover:bg-white/90 hover:text-gray-700";
      } else {
        className += "text-gray-300 hover:bg-white/80 hover:text-gray-400";
      }

      return (
        <button
          type="button"
          className={className}
          title={
            generated
              ? "Визуал сгенерирован — открыть"
              : desc
                ? "Есть описание визуала — открыть"
                : "Описание визуала пусто"
          }
          disabled={busy}
          onClick={(ev) => {
            ev.stopPropagation();
            setVisualDialogIndex(index);
          }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" strokeWidth={1.75} />}
        </button>
      );
    },
    [generatingAll, generatingIndex, pendingIndices],
  );

  async function onGenerateAll() {
    if (pendingIndices.length === 0) {
      toast.message("Нет карточек с описанием визуала без сгенерированного изображения");
      return;
    }
    setGeneratingAll(true);
    let ok = 0;
    try {
      for (const index of pendingIndices) {
        const entity = entities[index];
        const desc = visualDescription(entity);
        if (!desc) continue;
        setGeneratingIndex(index);
        try {
          const dataUrl = await generateCardVisualImage(desc, imageModel);
          updateEntity(index, {
            visual: {
              type: entity.visual?.type ?? null,
              description: desc,
              generatedImage: dataUrl,
            },
          });
          ok += 1;
        } catch (e: unknown) {
          toast.error(
            `Карточка ${index + 1}: ${e instanceof Error ? e.message : "ошибка генерации"}`,
          );
        }
      }
      if (ok > 0) toast.success(`Сгенерировано изображений: ${ok}`);
    } finally {
      setGeneratingIndex(null);
      setGeneratingAll(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={onGenerateAll}
          disabled={generatingAll || pendingIndices.length === 0}
        >
          {generatingAll ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <ImageIcon className="size-3.5 mr-1" />}
          Сгенерировать все изображения
          {pendingIndices.length > 0 ? ` (${pendingIndices.length})` : ""}
        </Button>
      </div>

      <SimpleContentPreview
        analysis={analysis}
        profile={profile}
        editable
        renderCardToolbarExtra={renderVisualIcon}
      />

      <EntityVisualDialog
        open={visualDialogIndex !== null}
        entity={visualDialogIndex !== null ? entities[visualDialogIndex] ?? null : null}
        entityIndex={visualDialogIndex}
        imageModel={imageModel}
        onClose={() => setVisualDialogIndex(null)}
        onSave={(index, visual) => updateEntity(index, { visual })}
      />
    </div>
  );
}
