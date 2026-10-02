import { TextractManager } from "./manager.js";
import { parseAadhaarData } from "./helpers/parser.js";
import { env } from "@lib/env/environment.js";
import type { ImageInput, TextractResult, AadhaarData } from "./types.js";

/**
 * Check if all required fields are present for success
 */
function isCompleteAadhaarData(
  data: AadhaarData
): data is Required<AadhaarData> {
  return (
    data.name !== undefined &&
    data.aadhaarNumber !== undefined &&
    data.gender !== undefined &&
    data.dateOfBirth !== undefined
  );
}

/**
 * Extract Aadhaar data from an image
 * @param image - Image input (buffer or S3 reference)
 * @returns Extraction result with Aadhaar data
 * @example
 * ```ts
 * // Using buffer (from file upload)
 * const result = await extractAadhaarFromImage({
 *   type: "buffer",
 *   data: fileBuffer
 * });
 * 
 * // Using S3
 * const result = await extractAadhaarFromImage({
 *   type: "s3",
 *   bucket: "my-bucket",
 *   key: "aadhaar/image.jpg"
 * });
 * 
 * if (result.success) {
 *   console.log(result.data.aadhaarNumber); // "123456789012" (guaranteed)
 *   console.log(result.data.name);          // "SRAJAN SAXENA" (guaranteed)
 * } else {
 *   console.log(result.error); // Error message
 *   console.log(result.data);  // Partial data or undefined
 * }
 * ```
 */
export async function extractAadhaarFromImage(
  image: ImageInput
): Promise<TextractResult> {
  try {
    const textractManager = new TextractManager(env.AWS_REGION);
    const blocks = await textractManager.detectDocumentText(image);
    const textLines = textractManager.extractTextLines(blocks);

    if (textLines.length === 0) {
      return {
        success: false,
        data: undefined,
        error: "No text detected in the image",
      };
    }

    const aadhaarData = parseAadhaarData(textLines);

    // Check if all required fields are present
    if (!isCompleteAadhaarData(aadhaarData)) {
      const missingFields: string[] = [];
      if (!aadhaarData.name) missingFields.push("name");
      if (!aadhaarData.aadhaarNumber) missingFields.push("aadhaarNumber");
      if (!aadhaarData.gender) missingFields.push("gender");
      if (!aadhaarData.dateOfBirth) missingFields.push("dateOfBirth");

      return {
        success: false,
        data: aadhaarData,
        error: `Could not extract: ${missingFields.join(", ")}`,
      };
    }

    return {
      success: true,
      data: aadhaarData,
      error: undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      data: undefined,
      error: `Textract error: ${errorMessage}`,
    };
  }
}

export { parseAadhaarData } from "./helpers/parser.js";
