import { redisService } from "@redis/index.js";
import { env } from "@lib/env/environment.js";
import type { NextFunction, Response } from "express";
import { BadRequest } from "zodex-axon/errors";
import { catchAsync } from "zodex-axon/core";
import { type AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import { getOtpRateLimitKey } from "@root/services/redis/keys/redis.keys";

const TTL_BUFFER_SECONDS = 5;

const RATE_LIMIT_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

export const otpRateLimitMiddleware = catchAsync(
  async (req: AuthenticatedUserRequestWithVerifiedEmail, res: Response, next: NextFunction) => {
    const userId = req.user.id;
    const key = getOtpRateLimitKey(userId);

    const count = (await redisService.eval(
      RATE_LIMIT_SCRIPT,
      [key],
      [String(env.OTP_RATE_LIMIT_WINDOW_SECONDS)],
    )) as number;

    if (count > env.OTP_RATE_LIMIT_MAX) {
      const ttl = await redisService.ttl(key);
      const effectiveTtl = Math.max(0, ttl - TTL_BUFFER_SECONDS);

      if (effectiveTtl === 0) {
        await redisService.delete(key);
        return next();
      }

      const minutesLeft = Math.ceil(effectiveTtl / 60);

      return next(
        new BadRequest().handleResponse(res, {
          info: `OTP request limit reached. Try again in ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}.`,
        }),
      );
    }

    next();
  },
);
