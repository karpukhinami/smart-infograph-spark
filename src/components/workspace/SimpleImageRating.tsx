import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

const RATING_ACCENT = "#A78BFA";

interface Props {
  imageId: string;
}

export function SimpleImageRating({ imageId }: Props) {
  const rating = useProjectStore((s) => s.simpleImageRatings[imageId]);
  const setRating = useProjectStore((s) => s.setSimpleImageRating);

  const btnClass = (kind: "like" | "dislike") =>
    cn(
      "inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition-colors",
      "text-muted-foreground hover:text-foreground hover:bg-muted/60",
      rating === kind && "border-[#A78BFA]/40",
    );

  const btnStyle = (kind: "like" | "dislike") =>
    rating === kind
      ? { backgroundColor: `${RATING_ACCENT}33`, color: "#6D28D9" }
      : undefined;

  return (
    <div className="flex items-center justify-end gap-1.5 pt-2">
      <button
        type="button"
        className={btnClass("like")}
        style={btnStyle("like")}
        title="Нравится"
        aria-pressed={rating === "like"}
        onClick={() => setRating(imageId, "like")}
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        type="button"
        className={btnClass("dislike")}
        style={btnStyle("dislike")}
        title="Не нравится"
        aria-pressed={rating === "dislike"}
        onClick={() => setRating(imageId, "dislike")}
      >
        <ThumbsDown className="size-3.5" />
      </button>
      {!rating && (
        <div className="relative ml-1 shrink-0 rounded-lg border border-border bg-card px-2 py-1 text-[11px] leading-none whitespace-nowrap text-muted-foreground shadow-sm">
          <span
            aria-hidden
            className="absolute left-0 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-l border-border bg-card"
          />
          Оцените генерацию
        </div>
      )}
    </div>
  );
}
