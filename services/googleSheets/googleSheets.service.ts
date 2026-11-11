import { auth, sheets as createSheetsClient, type sheets_v4 } from "@googleapis/sheets";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";

// ═══════════════════════════════════════════════════════════════════
// GOOGLE SHEETS EXPORT SERVICE
//
// Appends one row per completed user profile to a Google Sheet using a
// service account. All GOOGLE_SHEETS_* env vars are OPTIONAL: when any
// required one is missing the server runs normally but no exports happen.
//
// Safety notes:
// - Rows are written with valueInputOption "RAW" so user-supplied text
//   (e.g. a college named "=HYPERLINK(...)") is stored as text, never
//   interpreted as a formula.
// - The kyId column is checked before appending, so a BullMQ retry after
//   a lost response does not create a duplicate row.
// - Nothing in this file logs the private key, email or phone number.
// ═══════════════════════════════════════════════════════════════════

/** Column order in the sheet. Row 1 of the tab must contain exactly these headers. */
export const SHEET_COLUMNS = [
  "kyId",
  "name",
  "email",
  "phone",
  "college",
  "isIITBHU",
  "profileCompletedAt",
] as const;

export interface UserSheetRow {
  kyId: string;
  name: string;
  email: string;
  phone: string;
  college: string;
  isIITBHU: boolean;
  /** ISO-8601 timestamp */
  profileCompletedAt: string;
}

export type AppendResult = "appended" | "duplicate";

const REQUEST_TIMEOUT_MS = 15_000;

interface SheetsConfig {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
  tabName: string;
}

/** Treat empty / whitespace-only values the same as unset. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Env files and parameter stores often store the PEM with literal "\n"
 * sequences and sometimes wrap it in quotes - normalise both.
 */
function normalisePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

/** Names of required GOOGLE_SHEETS_* vars that are not set. */
export function getMissingSheetsEnvVars(): string[] {
  const missing: string[] = [];
  if (!clean(env.GOOGLE_SHEETS_CLIENT_EMAIL)) missing.push("GOOGLE_SHEETS_CLIENT_EMAIL");
  if (!clean(env.GOOGLE_SHEETS_PRIVATE_KEY)) missing.push("GOOGLE_SHEETS_PRIVATE_KEY");
  if (!clean(env.GOOGLE_SHEETS_SPREADSHEET_ID)) missing.push("GOOGLE_SHEETS_SPREADSHEET_ID");
  return missing;
}

export function isSheetsExportConfigured(): boolean {
  return getMissingSheetsEnvVars().length === 0;
}

function getConfig(): SheetsConfig {
  const clientEmail = clean(env.GOOGLE_SHEETS_CLIENT_EMAIL);
  const privateKey = clean(env.GOOGLE_SHEETS_PRIVATE_KEY);
  const spreadsheetId = clean(env.GOOGLE_SHEETS_SPREADSHEET_ID);

  if (!clientEmail || !privateKey || !spreadsheetId) {
    // Callers are expected to check isSheetsExportConfigured() first.
    throw new Error(
      `Google Sheets export is not configured (missing: ${getMissingSheetsEnvVars().join(", ")})`,
    );
  }

  return {
    clientEmail,
    privateKey: normalisePrivateKey(privateKey),
    spreadsheetId,
    tabName: clean(env.GOOGLE_SHEETS_TAB_NAME) ?? "Users",
  };
}

let cachedClient: sheets_v4.Sheets | null = null;

function getClient(config: SheetsConfig): sheets_v4.Sheets {
  if (!cachedClient) {
    const jwt = new auth.JWT({
      email: config.clientEmail,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    cachedClient = createSheetsClient({ version: "v4", auth: jwt });
  }
  return cachedClient;
}

/** A1 range for a tab. Tab names are quoted; embedded quotes are doubled. */
function tabRange(tabName: string, cells: string): string {
  return `'${tabName.replace(/'/g, "''")}'!${cells}`;
}

function toSheetValues(row: UserSheetRow): (string | boolean)[] {
  return [
    row.kyId,
    row.name,
    row.email,
    row.phone,
    row.college,
    row.isIITBHU,
    row.profileCompletedAt,
  ];
}

/** Safe error summary: never include request config, which could carry credentials. */
export function describeSheetsError(error: unknown): { message: string; code?: number | string } {
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; code?: unknown };
    return {
      message: typeof e.message === "string" ? e.message : String(error),
      code: typeof e.code === "number" || typeof e.code === "string" ? e.code : undefined,
    };
  }
  return { message: String(error) };
}

/**
 * Append the row unless a row with the same kyId already exists.
 * Throws on any API failure so the caller (BullMQ) can retry.
 */
export async function appendUserRowIfMissing(row: UserSheetRow): Promise<AppendResult> {
  const config = getConfig();
  const client = getClient(config);

  // 1. Duplicate check against the kyId column.
  const existing = await client.spreadsheets.values.get(
    {
      spreadsheetId: config.spreadsheetId,
      range: tabRange(config.tabName, "A:A"),
      majorDimension: "COLUMNS",
    },
    { timeout: REQUEST_TIMEOUT_MS },
  );
  const kyIds = existing.data.values?.[0] ?? [];
  if (kyIds.includes(row.kyId)) {
    return "duplicate";
  }

  // 2. Append.
  const res = await client.spreadsheets.values.append(
    {
      spreadsheetId: config.spreadsheetId,
      range: tabRange(config.tabName, `A:${String.fromCharCode(64 + SHEET_COLUMNS.length)}`),
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [toSheetValues(row)] },
    },
    { timeout: REQUEST_TIMEOUT_MS },
  );

  logger.debug("Google Sheets row appended", {
    kyId: row.kyId,
    updatedRange: res.data.updates?.updatedRange,
    updatedRows: res.data.updates?.updatedRows,
  });

  return "appended";
}
