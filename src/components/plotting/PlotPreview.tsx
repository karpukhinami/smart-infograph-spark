import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileJson, Hammer, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePlotStore } from "@/lib/plotting/store";
import { draftRenderPoints, sceneCurves, scenePoints } from "@/lib/plotting/scene";
import { renderPlotSvg } from "@/lib/plotting/render";
import { renderLineSvg } from "@/lib/plotting/line/render";
import { renderSpaceSvg } from "@/lib/plotting/space/render";
import { generatePlotBeautifiedImage } from "@/lib/plotting/beautify";
import { downloadPng, downloadSceneJson, downloadSvg, readSceneJson } from "@/lib/plotting/export";
import { PlotBeautifyDialog } from "@/components/plotting/PlotBeautifyDialog";
import { toast } from "sonner";

export function PlotPreview() {
  const scene = usePlotStore((state) => state.scene);
  const status = usePlotStore((state) => state.status);
  const pointDraft = usePlotStore((state) => state.pointDraft);
  const buildAll = usePlotStore((state) => state.buildAll);
  const importScene = usePlotStore((state) => state.importScene);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const spaceTab = usePlotStore((state) => state.spaceTab);

  const [beautifyOpen, setBeautifyOpen] = useState(false);
  const [beautifying, setBeautifying] = useState(false);
  const [beautifiedImage, setBeautifiedImage] = useState<string | null>(null);

  const svg = useMemo(() => {
    if (scene.space === "line") return renderLineSvg(scene);
    if (scene.space === "space" && scene.space3d) return renderSpaceSvg(scene.space3d);
    return renderPlotSvg(scene, sceneCurves(scene), [
      ...scenePoints(scene),
      ...draftRenderPoints(scene, pointDraft),
    ]);
  }, [scene, pointDraft]);

  useEffect(() => {
    setBeautifiedImage(null);
  }, [svg]);

  async function onBeautifyDraw(wishes: string) {
    const container = previewRef.current;
    if (!container || !svg) {
      toast.error("Сначала постройте чертёж");
      return;
    }
    setBeautifying(true);
    try {
      const dataUrl = await generatePlotBeautifiedImage({ previewEl: container, userWishes: wishes });
      setBeautifiedImage(dataUrl);
      setBeautifyOpen(false);
      toast.success("Дорисованная версия готова");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось дорисовать чертёж");
    } finally {
      setBeautifying(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={buildAll}>
            <Hammer className="size-4" />
            Построить всё
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!svg}
            onClick={() => svg && downloadSvg(svg)}
          >
            <Download className="size-4" />
            SVG
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!svg}
            onClick={() => svg && downloadPng(svg)}
          >
            <Download className="size-4" />
            PNG
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => downloadSceneJson(scene)}
          >
            <FileJson className="size-4" />
            Сохранить JSON
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Загрузить JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                importScene(await readSceneJson(file));
                toast.success("Чертёж загружен");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Не удалось прочитать файл");
              }
            }}
          />
        </div>

        <div
          ref={previewRef}
          className="overflow-auto rounded-md border border-border bg-background p-2"
        >
          {svg ? (
            <div className="[&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {spaceTab === "line"
                ? "Заполните пределы оси, чтобы увидеть числовую прямую."
                : spaceTab === "space"
                  ? "Выберите фигуру и создайте параллелепипед."
                  : "Заполните пределы обеих осей, чтобы увидеть координатную плоскость."}
            </p>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full"
          disabled={!svg || beautifying}
          onClick={() => setBeautifyOpen(true)}
        >
          <Sparkles className="size-4" />
          Сделать красиво
        </Button>

        {beautifiedImage && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Дорисованная версия</p>
            <div className="overflow-auto rounded-md border border-border bg-background p-2">
              <img src={beautifiedImage} alt="Дорисованный чертёж" className="h-auto w-full" />
            </div>
          </div>
        )}

        {status && status.errors.length > 0 && (
          <ul className="space-y-1 text-xs text-destructive">
            {status.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        )}
        {status && status.errors.length === 0 && (
          <p className="text-xs text-muted-foreground">Построено объектов: {status.built}.</p>
        )}

        <PlotBeautifyDialog
          open={beautifyOpen}
          busy={beautifying}
          onOpenChange={setBeautifyOpen}
          onDraw={onBeautifyDraw}
        />
      </CardContent>
    </Card>
  );
}
