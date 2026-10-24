#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * CLEAR ALL REDIS CACHES
 *
 * Usage:
 *   pnpm run clear-cache           # clears app caches only
 *   pnpm run clear-cache --all     # FLUSHDB entire Redis database
 *
 * By default, clears only application caches (cache:* keys).
 * With --all flag, flushes the ENTIRE Redis database (use with caution).
 *
 * Requires env vars from .env (uses project's redis-axon connection).
 * ═══════════════════════════════════════════════════════════════════
 */

import { RedisSingleConnectionHandler } from "redis-axon/connection/connection.js";
import { env } from "../lib/env/environment.js";

// ─────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────

const flushAll = process.argv.includes("--all");

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔌 Connecting to Redis...");

  const redisService = new RedisSingleConnectionHandler({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    username: env.REDIS_USERNAME,
    password: env.REDIS_PASSWORD,
    keepAlive: 10_000,
    connectTimeout: 5_000,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });

  await redisService.ConnectToService();
  const client = redisService.redisConnection!;
  console.log(`✅ Connected to Redis (${env.REDIS_HOST}:${env.REDIS_PORT})\n`);

  if (flushAll) {
    // ═══════════════════════════════════════════════════════════════
    // FLUSH ENTIRE DATABASE (--all flag)
    // ═══════════════════════════════════════════════════════════════
    console.log("⚠️  --all flag detected: Flushing ENTIRE Redis database...");
    console.log("   This will clear rate limits, OTP state, admin tokens, etc.\n");

    await client.flushdb();
    console.log("🗑️  FLUSHDB complete — all keys deleted.\n");
  } else {
    // ═══════════════════════════════════════════════════════════════
    // SELECTIVE CACHE CLEAR (default)
    // ═══════════════════════════════════════════════════════════════
    console.log("🧹 Clearing application caches only (cache:* keys)...\n");

    // 1. Bump version counters to orphan versioned caches
    const scheduleVerKey = "cache:v1:schedule:ver";
    const eventsVerKey = "cache:v1:events:ver";

    const scheduleVer = await client.incr(scheduleVerKey);
    console.log(`   📅 Schedule cache version bumped → ${scheduleVer}`);

    const eventsVer = await client.incr(eventsVerKey);
    console.log(`   📋 Events cache version bumped → ${eventsVer}`);

    // 2. Delete global passes cache
    const passesKey = "cache:v1:passes";
    const passesDeleted = await client.del(passesKey);
    console.log(`   🎫 Passes cache deleted: ${passesDeleted > 0 ? "yes" : "already empty"}`);

    // 3. Scan and delete all cache:* keys
    let cursor = "0";
    let totalDeleted = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", "cache:*", "COUNT", "100");
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== "0");

    console.log(`   🗑️  Scan-deleted ${totalDeleted} cache:* keys\n`);
  }

  // Show remaining keys summary
  const dbSize = await client.dbsize();
  console.log(`📊 Redis DB now has ${dbSize} keys remaining.`);

  await client.quit();
  console.log("👋 Done.\n");
}

main().catch((err: Error) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
