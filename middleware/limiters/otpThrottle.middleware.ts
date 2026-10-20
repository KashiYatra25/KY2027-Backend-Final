import { redisService } from "@redis/index.js";
import { env } from "@lib/env/environment.js";
import type { NextFunction, Response } from "express";
import { BadRequest } from "zodex-axon/errors";
import { catchAsync } from "zodex-axon/core";
import { type AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import { getOtpThrottleKey } from "@root/services/redis/keys/redis.keys";

const TTL_BUFFER_SECONDS = 5;

// Returns 1 if key was newly set (free to proceed), 0 if already existed (in cooldown).
const THROTTLE_SCRIPT = `
  local set = redis.call('SET', KEYS[1], '1', 'NX', 'EX', ARGV[1])
  if set then return 1 else return 0 end
`;

export const otpThrottleMiddleware = catchAsync(
  async (req: AuthenticatedUserRequestWithVerifiedEmail, res: Response, next: NextFunction) => {
    const userId = req.user.id;
    const key = getOtpThrottleKey(userId);

    const isNewlySet = (await redisService.eval(
      THROTTLE_SCRIPT,
      [key],
      [String(env.OTP_THROTTLE_COOLDOWN_SECONDS)],
    )) as 0 | 1;

    if (!isNewlySet) {
      const ttl = await redisService.ttl(key);
      const effectiveTtl = Math.max(0, ttl - TTL_BUFFER_SECONDS);

      if (effectiveTtl === 0) {
        await redisService.delete(key);
        return next();
      }

      return next(
        new BadRequest().handleResponse(res, {
          info: `Please wait ${effectiveTtl} second${effectiveTtl > 1 ? "s" : ""} before requesting a new OTP.`,
        }),
      );
    }
    next();
  },
);
