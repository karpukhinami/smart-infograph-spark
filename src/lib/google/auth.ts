import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];

export function isGoogleArchiveConfigured(): boolean {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) return true;
  return Boolean(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

export function getGoogleAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const credentials = JSON.parse(json) as {
      client_email: string;
      private_key: string;
    };
    return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  }

  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("Google service account credentials are not configured");
  }

  return new google.auth.JWT({ email, key, scopes: SCOPES });
}
