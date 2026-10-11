/**
 * Extracted Aadhaar card data
 */
export interface AadhaarData {
  name?: string;
  aadhaarNumber?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: string; // Format: DD/MM/YYYY or YYYY
  rawText: string[]; // All detected text lines for debugging
}

/**
 * Success requires all fields to be present
 */
type SuccessAadhaarData = Required<AadhaarData>;

/**
 * Textract detection result - discriminated union
 *
 * Success: All fields extracted
 * PartialFailure: Some data extracted but missing required fields
 * Failure: No data could be extracted (image issue, AWS error, etc.)
 */
export type TextractResult =
  | {
      success: true;
      data: SuccessAadhaarData;
      error: undefined;
    }
  | {
      success: false;
      data: AadhaarData;
      error: string;
    }
  | {
      success: false;
      data: undefined;
      error: string;
    };

/**
 * Supported image input types
 */
export type ImageInput =
  | { type: "buffer"; data: Buffer }
  | { type: "s3"; bucket: string; key: string };
