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

export type ArchiveError = {
  ok: false;
  status: number;
  message: string;
  sessionFolderId?: string;
  folderLink?: string;
};
export type ArchiveImageSuccess = SimpleImageArchiveMeta & {
  ok: true;
  sessionFolderId: string;
};

export async function archiveImageToGoogle(
  payload: ArchiveImagePayload,
): Promise<ArchiveImageSuccess | ArchiveError> {
  try {
    const res = await fetch("/api/archive-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      let message = text || res.statusText || "Archive request failed";
      let sessionFolderId: string | undefined;
      let folderLink: string | undefined;
      try {
        const parsed = JSON.parse(text) as {
          error?: string;
          sessionFolderId?: string;
          folderLink?: string;
        };
        if (parsed.error) message = parsed.error;
        sessionFolderId = parsed.sessionFolderId;
        folderLink = parsed.folderLink;
      } catch {
        /* plain text error body */
      }
      console.error("[archive-image]", res.status, message);
      return { ok: false, status: res.status, message, sessionFolderId, folderLink };
    }
    const data = JSON.parse(text) as SimpleImageArchiveMeta & { sessionFolderId: string };
    console.info("[archive-image] ok", { sheetRow: data.sheetRow, imageId: payload.imageId });
    return { ok: true, ...data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    console.error("[archive-image]", message);
    return { ok: false, status: 0, message };
  }
}

export async function updateArchiveFeedback(
  payload: ArchiveFeedbackPayload,
): Promise<{ ok: true } | ArchiveError> {
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
    if (res.ok) {
      console.info("[archive-feedback] ok", { sheetRow: payload.sheetRow });
      return { ok: true };
    }
    const text = await res.text().catch(() => "");
    const message = text || res.statusText || "Feedback update failed";
    console.error("[archive-feedback]", res.status, message);
    return { ok: false, status: res.status, message };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    console.error("[archive-feedback]", message);
    return { ok: false, status: 0, message };
  }
}

/** Poll until archive finishes, fails, or timeout. */
export async function waitForArchiveSheetRow(
  _imageId: string,
  getState: () => { sheetRow?: number; error?: string },
  timeoutMs = 90_000,
): Promise<number | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { sheetRow, error } = getState();
    if (error) return null;
    if (sheetRow) return sheetRow;
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}
