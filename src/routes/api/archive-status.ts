import { createFileRoute } from "@tanstack/react-router";
import { isGoogleArchiveConfigured } from "@/lib/google/auth";

export const Route = createFileRoute("/api/archive-status")({
  server: {
    handlers: {
      GET: async () => {
        const configured = isGoogleArchiveConfigured();
        const hasDrive = Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID?.trim());
        const hasSheet = Boolean(process.env.GOOGLE_SHEETS_ID?.trim());
        return Response.json({
          configured,
          hasDriveFolderId: hasDrive,
          hasSheetsId: hasSheet,
          ready: configured && hasDrive && hasSheet,
        });
      },
    },
  },
});
