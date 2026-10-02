// OTP related keys
const getOtpThrottleKey = (userId: string) => `otp:throttle:${userId}`;
const getOtpRateLimitKey = (userId: string) => `otp:rateLimit:${userId}`;

// User profile keys
const getAccountProgressKey = (userId: string) => `accountProgress:${userId}`;
const getProfileCompletionKey = (userId: string) => `profileCompletion:${userId}`;

export {
  getOtpRateLimitKey,
  getOtpThrottleKey,
  getAccountProgressKey,
  getProfileCompletionKey,
};
