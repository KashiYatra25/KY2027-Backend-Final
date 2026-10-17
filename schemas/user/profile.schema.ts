import {
  isValidPhoneNumber,
  parsePhoneNumberWithError,
} from "libphonenumber-js";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// IIT BHU COLLEGE NAME VALIDATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Regex to detect IIT BHU / IIT Varanasi variants that users should NOT be able to manually enter.
 * IIT BHU users get their college auto-set via Google OAuth.
 * 
 * Catches:
 * - iit bhu, iitbhu, iit(bhu), iit [bhu], iit-bhu
 * - iit varanasi
 * - indian institute of technology bhu
 * - indian institute of technology (bhu) varanasi
 * - indian institute of technology varanasi
 * 
 * Does NOT block:
 * - Banaras Hindu University (BHU) - separate institution, allowed
 */
const IIT_BHU_REGEX = /i{1,2}\.?\s*t\.?\s*[\(\[\-]?\s*bhu|i{1,2}\.?\s*t\.?\s*varanasi|indian\s+institute\s+of\s+technology\s*[\(\[]?\s*bhu|indian\s+institute\s+of\s+technology\s+varanasi/i;

/**
 * Check if a college name contains IIT BHU / IIT Varanasi variants
 */
export function isIITBhuCollege(collegeName: string): boolean {
  return IIT_BHU_REGEX.test(collegeName);
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE UPDATE SCHEMA
// ═══════════════════════════════════════════════════════════════════

export const profileUpdationRequestSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .min(1, { message: "Phone number is required" })
    .transform((val) => (val.startsWith("+") ? val : `+${val}`)) // Add + if missing
    .superRefine((val, ctx) => {
      try {
        // CHECK 1: Basic validation
        if (!isValidPhoneNumber(val)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid phone number format.",
          });
          return z.NEVER;
        }

        // CHECK 2: Parse using the new function name
        // This will THROW an error if the number is unparseable
        const phoneNumber = parsePhoneNumberWithError(val);

        // Security Check: Ensure country code exists
        if (!phoneNumber.country) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Phone number must include a valid country code (e.g., +91).",
          });
          return z.NEVER;
        }
      } catch (error) {
        // This catch block now properly handles the errors thrown by parsePhoneNumberWithError
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid phone number format.",
        });
        return z.NEVER;
      }
    })
    // TRANSFORMATION: Normalize to E.164
    .transform((val) => {
      // Use the error-throwing version here too
      // (It's safe because superRefine already passed)
      const phoneNumber = parsePhoneNumberWithError(val);
      return phoneNumber.number; // Returns '+919876543210'
    })
    .optional(),
  college: z
    .string()
    .min(2, "College name must be at least 2 characters")
    .max(200, "College name must be at most 200 characters")
    .refine(
      (val) => !isIITBhuCollege(val),
      {
        message: "IIT BHU students are automatically verified via their institute email. Please use your @itbhu.ac.in or @iitbhu.ac.in email to sign in.",
      }
    )
    .optional(),
});

export type ProfileUpdationRequestSchemaType = z.infer<typeof profileUpdationRequestSchema>;

// ═══════════════════════════════════════════════════════════════════
// MANUAL IDENTITY VERIFICATION SCHEMA
// For users who choose not to use Aadhaar
// ═══════════════════════════════════════════════════════════════════

export const manualIdentityVerificationSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((val) => {
      const date = new Date(val);
      const now = new Date();
      const minAge = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
      const maxAge = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
      return date <= minAge && date >= maxAge;
    }, "You must be between 10 and 100 years old"),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]),
});

export type ManualIdentityVerificationSchemaType = z.infer<typeof manualIdentityVerificationSchema>;
