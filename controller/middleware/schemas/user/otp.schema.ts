import { z } from 'zod';
// 1. Change the import here
import { parsePhoneNumberWithError, isValidPhoneNumber } from 'libphonenumber-js';

export const otpGenerationSchema = z.object({
  phoneNumber: z.string()
    .trim()
    .min(1, { message: "Phone number is required" })
    .transform((val) => val.startsWith('+') ? val : `+${val}`) // Add + if missing
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
            message: "Phone number must include a valid country code (e.g., +91).",
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
    }),
});

export const otpVerificationSchema = z.object({
  otp: z.string().length(6, { message: 'OTP must be 6 digits' }),
  phoneNumber: z.string().min(1, { message: 'Phone number is required' }),
});

export type OtpGenerationSchemaType = z.infer<typeof otpGenerationSchema>;
export type OtpVerificationSchemaType = z.infer<typeof otpVerificationSchema>;