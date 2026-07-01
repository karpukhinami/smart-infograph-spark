import { useState } from "react";

import { ThumbsDown, ThumbsUp } from "lucide-react";

import { cn } from "@/lib/utils";

import { useProjectStore } from "@/store/useProjectStore";

import { ImageFeedbackModal } from "@/components/workspace/ImageFeedbackModal";

import { updateArchiveFeedback } from "@/lib/archive-client";

import {

  EMPTY_FEEDBACK_AXES,

  type ImageFeedbackRating,

  type SimpleImageFeedbackDetail,

} from "@/lib/image-feedback-types";



const RATING_ACCENT = "#A78BFA";



interface Props {

  imageId: string;

  showIllustrationsRow: boolean;

  onRate?: (rating: ImageFeedbackRating) => void;

}



export function SimpleImageRating({ imageId, showIllustrationsRow, onRate }: Props) {

  const rating = useProjectStore((s) => s.simpleImageRatings[imageId]);

  const feedbackCompleted = useProjectStore((s) => s.simpleImageFeedbackCompleted[imageId]);

  const setRating = useProjectStore((s) => s.setSimpleImageRating);

  const setFeedback = useProjectStore((s) => s.setSimpleImageFeedback);

  const markFeedbackCompleted = useProjectStore((s) => s.markSimpleImageFeedbackCompleted);



  const [modalOpen, setModalOpen] = useState(false);

  const [modalRating, setModalRating] = useState<ImageFeedbackRating>("like");



  const btnClass = (kind: ImageFeedbackRating) =>

    cn(

      "inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition-colors",

      "text-muted-foreground hover:text-foreground hover:bg-muted/60",

      rating === kind && "border-[#A78BFA]/40",

    );



  const btnStyle = (kind: ImageFeedbackRating) =>

    rating === kind

      ? { backgroundColor: `${RATING_ACCENT}33`, color: "#6D28D9" }

      : undefined;



  const syncFeedbackToArchive = async (opts: {

    sent: boolean;

    detail?: SimpleImageFeedbackDetail;

  }) => {

    const archiveMeta = useProjectStore.getState().simpleImageArchiveMeta[imageId];

    if (!archiveMeta?.sheetRow) return;

    const currentRating = useProjectStore.getState().simpleImageRatings[imageId] ?? modalRating;

    await updateArchiveFeedback({

      sheetRow: archiveMeta.sheetRow,

      rating: currentRating,

      feedbackSent: opts.sent ? 1 : 0,

      showIllustrationsRow,

      detail: opts.sent

        ? opts.detail

        : {

            ...EMPTY_FEEDBACK_AXES,

            comment: "",

          },

    });

  };



  const handleRate = (kind: ImageFeedbackRating) => {

    setRating(imageId, kind);

    onRate?.(kind);

    if (!feedbackCompleted) {

      setModalRating(kind);

      setModalOpen(true);

    }

  };



  const closeModal = () => {

    setModalOpen(false);

    markFeedbackCompleted(imageId);

  };



  return (

    <>

      <div className="flex items-center justify-end gap-1.5 pt-2">

        <button

          type="button"

          className={btnClass("like")}

          style={btnStyle("like")}

          title="Нравится"

          aria-pressed={rating === "like"}

          onClick={() => handleRate("like")}

        >

          <ThumbsUp className="size-3.5" />

        </button>

        <button

          type="button"

          className={btnClass("dislike")}

          style={btnStyle("dislike")}

          title="Не нравится"

          aria-pressed={rating === "dislike"}

          onClick={() => handleRate("dislike")}

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



      <ImageFeedbackModal

        open={modalOpen}

        rating={modalRating}

        showIllustrationsRow={showIllustrationsRow}

        onSkip={() => {

          closeModal();

          void syncFeedbackToArchive({ sent: false });

        }}

        onSubmit={(detail) => {

          setFeedback(imageId, detail);

          closeModal();

          void syncFeedbackToArchive({ sent: true, detail });

        }}

      />

    </>

  );

}

