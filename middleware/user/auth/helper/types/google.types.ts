import type { Request } from "express";
import type { VerifiedGoogleUser } from "@services/google/googleOAuth.service.js";

/**
 * Request with verified Google user data
 */
export interface GoogleVerifiedRequest extends Request {
  googleData: VerifiedGoogleUser;
}
