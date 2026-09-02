/** Поле исходного материала для режима ИИ на странице Plotting. */
import { useRef, useState } from "react";
import { FileText, ImageIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  importSourceFiles,
  SOURCE_FILE_ACCEPT,
  classifySourceFile,
} from "@/lib/source-file-import";
import { cn } from "@/lib/utils";

export interface PlotSourceState {
  manualText: string;
  uploadedSourceText: string;
  attachedImages: string[];
}

interface DocumentAttachment {
  id: string;
  name: string;
  text: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function rebuildUploadedText(docs: DocumentAttachment[]): string {
  return docs
    .map((d) => d.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function usePlotSourceState() {
  const [manualText, setManualText] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);
  const uploadedSourceText = rebuildUploadedText(documents);

  const state: PlotSourceState = { manualText, uploadedSourceText, attachedImages };

  function removeImage(index: number) {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  }

  function removeDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function resetSource() {
    setManualText("");
    setAttachedImages([]);
    setDocuments([]);
  }

  return {
    state,
    manualText,
    setManualText,
    attachedImages,
    documents,
    removeImage,
    removeDocument,
    resetSource,
    addImages: (urls: string[]) => setAttachedImages((prev) => [...prev, ...urls]),
    addDocument: (doc: DocumentAttachment) => setDocuments((prev) => [...prev, doc]),
  };
}

export function PlotSourceInput({
  manualText,
  onManualTextChange,
  attachedImages,
  documents,
  onAttachFiles,
  onPasteImages,
  onRemoveImage,
  onRemoveDocument,
}: {
  manualText: string;
  onManualTextChange: (value: string) => void;
  attachedImages: string[];
  documents: DocumentAttachment[];
  onAttachFiles: (files: File[]) => Promise<void>;
  onPasteImages: (files: File[]) => Promise<void>;
  onRemoveImage: (index: number) => void;
  onRemoveDocument: (id: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onPasteCapture(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageFiles = items
      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => Boolean(f));
    if (imageFiles.length) {
      e.preventDefault();
      await onPasteImages(imageFiles);
    }
  }

  const hasAttachments = attachedImages.length > 0 || documents.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Исходный материал</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="size-3.5 mr-1" /> Файл
        </Button>
      </div>
      <Textarea
        rows={6}
        placeholder="Введите текст, формулы (LaTeX), Markdown или вставьте изображение (Ctrl/Cmd + V)"
        value={manualText}
        onChange={(e) => onManualTextChange(e.target.value)}
        onPaste={(e) => void onPasteCapture(e)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={SOURCE_FILE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void onAttachFiles(files);
          e.target.value = "";
        }}
      />
      {hasAttachments && (
        <div className="flex flex-wrap gap-2">
          {attachedImages.map((url, index) => (
            <AttachmentChip
              key={`img-${index}`}
              icon={<ImageIcon className="size-3.5 shrink-0" />}
              label={`Изображение ${index + 1}`}
              previewUrl={url}
              onRemove={() => onRemoveImage(index)}
            />
          ))}
          {documents.map((doc) => (
            <AttachmentChip
              key={doc.id}
              icon={<FileText className="size-3.5 shrink-0" />}
              label={doc.name}
              onRemove={() => onRemoveDocument(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentChip({
  icon,
  label,
  previewUrl,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  previewUrl?: string;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs",
      )}
    >
      {previewUrl ? (
        <img src={previewUrl} alt="" className="size-6 rounded object-cover" />
      ) : (
        icon
      )}
      <span className="truncate">{label}</span>
      <button
        type="button"
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Удалить"
        onClick={onRemove}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** Импорт файлов с раздельным учётом документов и изображений. */
export async function importPlotSourceFiles(
  files: File[],
  handlers: {
    addDocument: (doc: DocumentAttachment) => void;
    addImages: (urls: string[]) => void;
  },
): Promise<void> {
  for (const file of files) {
    if (classifySourceFile(file) === "image") {
      try {
        const dataUrl = await fileToDataUrl(file);
        handlers.addImages([dataUrl]);
        toast.success(`Изображение «${file.name}» загружено`);
      } catch {
        toast.error(`Не удалось загрузить «${file.name}»`);
      }
      continue;
    }

    await importSourceFiles([file], {
      getUploadedText: () => "",
      setUploadedText: (text) => {
        handlers.addDocument({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          text: text.trim(),
        });
      },
      addImages: (urls) => {
        if (urls.length) handlers.addImages(urls);
      },
      onSuccess: (message) => toast.success(message),
      onError: (message) => toast.error(message),
    });
  }
}

export type { DocumentAttachment };
