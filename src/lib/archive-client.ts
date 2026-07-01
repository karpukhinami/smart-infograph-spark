import type { GenTrigger, SimpleImageArchiveMeta } from "@/lib/google/archive-schema";
import type {
  BipolarFeedbackValue,
  ImageFeedbackRating,
  SimpleImageFeedbackDetail,
} from "@/lib/image-feedback-types";

export interface ArchiveImagePayload {
  imageId: string;
  dataUrl: string;
  sessionId: string;
  sessionFolderId?: string | null;
  version: number;
  genTrigger: GenTrigger;
  subject: string;
  className: string;
  topic: string;
  addedContent: boolean;
  style: string;
  profile: string;
  analysisModel: string;
  briefModel: string;
  imageModel: string;
}

export interface ArchiveFeedbackPayload {
  sheetRow: number;
  rating: ImageFeedbackRating;
  feedbackSent: 0 | 1;
  showIllustrationsRow: boolean;
  detail?: Pick<
    SimpleImageFeedbackDetail,
    "colors" | "composition" | "extraElements" | "text" | "illustrations" | "comment"
  >;
}

export async function archiveImageToGoogle(
  payload: ArchiveImagePayload,
): Promise<(SimpleImageArchiveMeta & { sessionFolderId: string }) | null> {
  try {
    const res = await fetch("/api/archive-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return (await res.json()) as SimpleImageArchiveMeta & { sessionFolderId: string };
  } catch {
    return null;
  }
}

export async function updateArchiveFeedback(payload: ArchiveFeedbackPayload): Promise<boolean> {
  try {
    const axes = payload.detail ?? {
      colors: "neutral" as BipolarFeedbackValue,
      composition: "neutral" as BipolarFeedbackValue,
      extraElements: "neutral" as BipolarFeedbackValue,
      text: "neutral" as BipolarFeedbackValue,
      illustrations: "neutral" as BipolarFeedbackValue,
      comment: "",
    };

    const res = await fetch("/api/archive-feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheetRow: payload.sheetRow,
        rating: payload.rating,
        feedbackSent: payload.feedbackSent,
        showIllustrationsRow: payload.showIllustrationsRow,
        color: axes.colors,
        composition: axes.composition,
        artefacts: axes.extraElements,
        text: axes.text,
        illustration: axes.illustrations,
        comment: axes.comment ?? "",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
