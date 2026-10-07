// OTP related keys
const getOtpThrottleKey = (userId: string) => `otp:throttle:${userId}`;
const getOtpRateLimitKey = (userId: string) => `otp:rateLimit:${userId}`;

// User profile keys
const getAccountProgressKey = (userId: string) => `accountProgress:${userId}`;
const getProfileCompletionKey = (userId: string) =>
  `profileCompletion:${userId}`;

// CA Referral ID generation keys
const CA_REFERRAL_RANGE_CURSOR_KEY = "ca:referral:range:cursor";

export {
  getOtpRateLimitKey,
  getOtpThrottleKey,
  getAccountProgressKey,
  getProfileCompletionKey,
  CA_REFERRAL_RANGE_CURSOR_KEY,
};
