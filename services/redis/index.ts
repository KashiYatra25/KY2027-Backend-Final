import { RedisSingleConnectionHandler } from "redis-axon/connection/connection.js";
import Redlock from "redlock";
import { env } from "@lib/env/environment.js";

// Create Redis connection
const redisService = new RedisSingleConnectionHandler({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  keepAlive: 10_000,
  connectTimeout: 5_000,
  enableReadyCheck: true,
  enableAutoPipelining: true,
  maxRetriesPerRequest: 0,
});

await redisService.ConnectToService();

// Create Redlock instance for distributed locking
export const redlock = new Redlock(
  [redisService.redisConnection! as unknown as Redlock.CompatibleRedisClient],
  { retryCount: 3, retryDelay: 200, retryJitter: 100 },
);

// Graceful shutdown handlers
process.on("SIGTERM", () => redisService.gracefulShutdown());
process.on("SIGINT", () => redisService.gracefulShutdown());

export { redisService };
