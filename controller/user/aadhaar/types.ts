import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";

// Extend request to include extracted Aadhaar data
export interface AadhaarExtractedRequest extends AuthenticatedUserRequestWithVerifiedEmail {
  aadhaarData: {
    name: string;
    aadhaarNumber: string;
    gender: "MALE" | "FEMALE" | "OTHER";
    dateOfBirth: string;
    key: string;
  };
}
