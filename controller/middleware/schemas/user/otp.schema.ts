// if in case we planned to use otp service we will remove the commented section

// import { z } from 'zod';
// 1. Change the import here
// import { parsePhoneNumberWithError, isValidPhoneNumber } from 'libphonenumber-js';

// export const otpVerificationSchema = z.object({
//   otp: z.string().length(6, { message: 'OTP must be 6 digits' }),
//   phoneNumber: z.string().min(1, { message: 'Phone number is required' }),
// });


// export type OtpVerificationSchemaType = z.infer<typeof otpVerificationSchema>;