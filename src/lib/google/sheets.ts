import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google/auth";
import {
  buildFeedbackSheetValues,
  buildInitialSheetRow,
  parseSheetRowFromUpdatedRange,
  SHEET_COL,
  type ArchiveGenerationFields,
  type FeedbackUpdateFields,
} from "@/lib/google/archive-schema";

function sheetName(): string {
  return process.env.GOOGLE_SHEET_NAME?.trim() || "Sheet1";
}

function columnLetter(index1Based: number): string {
  let n = index1Based;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function appendGenerationRow(
  fields: ArchiveGenerationFields,
): Promise<{ sheetRow: number }> {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const name = sheetName();
  const row = buildInitialSheetRow(fields);

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `${name}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  const sheetRow = parseSheetRowFromUpdatedRange(res.data.updates?.updatedRange);
  if (!sheetRow) throw new Error("Could not determine appended sheet row");

  return { sheetRow };
}

export async function updateFeedbackRow(
  sheetRow: number,
  fields: FeedbackUpdateFields,
): Promise<void> {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const name = sheetName();
  const startCol = columnLetter(SHEET_COL.rating);
  const endCol = columnLetter(SHEET_COL.comment);
  const values = buildFeedbackSheetValues(fields);

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `${name}!${startCol}${sheetRow}:${endCol}${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}
