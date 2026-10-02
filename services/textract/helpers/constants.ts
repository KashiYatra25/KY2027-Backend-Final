
/**
 * Aadhaar number regex - 12 digits, may have spaces (XXXX XXXX XXXX)
 */
const AADHAAR_REGEX = /\b(\d{4}\s?\d{4}\s?\d{4})\b/;

/**
 * Date of birth patterns
 * Matches: DD/MM/YYYY, DD-MM-YYYY, or just year
 */
const DOB_PATTERNS = [
  /DOB\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
  /Date\s*of\s*Birth\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
  /Birth\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
  /जन्म\s*तिथि\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i, // Hindi
  /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/, // Standalone date
  /Year\s*of\s*Birth\s*[:\-]?\s*(\d{4})/i,
  /YOB\s*[:\-]?\s*(\d{4})/i,
];

/**
 * Gender patterns
 */
const GENDER_PATTERNS = {
  MALE: [/\bMALE\b/i, /\bपुरुष\b/, /\b(M)\b/],
  FEMALE: [/\bFEMALE\b/i, /\bमहिला\b/, /\bस्त्री\b/, /\b(F)\b/],
};

/**
 * Words to exclude from name extraction
 */
const NAME_EXCLUSIONS = [
  "government",
  "india",
  "aadhaar",
  "aadhar",
  "unique",
  "identification",
  "authority",
  "uidai",
  "male",
  "female",
  "dob",
  "date",
  "birth",
  "year",
  "address",
  "download",
  "generated",
  "vid",
  "help",
  "issue",
  "भारत",
  "सरकार",
  "आधार",
];


export { NAME_EXCLUSIONS , DOB_PATTERNS , AADHAAR_REGEX , GENDER_PATTERNS }