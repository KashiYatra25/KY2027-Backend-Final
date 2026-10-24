import http from "http";
import { app } from "@app/app.js";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import { createApolloServer } from "@root/graphql/engine/engine";
import { fileURLToPath } from "url";
import { expressMiddleware } from "@as-integrations/express5";
import { userRoutesGQLProtectMiddleware } from "@root/middleware/user/protect/index.js";
import { referralIdService } from "@root/services/referral/index.js";
import { kyIdService } from "@services/kyId/kyId.service.js";
import { initializeGoogleOAuthClient } from "@services/google/googleOAuth.service.js";
import {
  startEmailWorker,
  stopEmailWorker,
  closeEmailQueue,
} from "@services/queue/index.js";
import { clearAllCachesOnStartup } from "@services/redis/clearCacheOnStartup.service.js";

// Create HTTP server from Express app (required for Apollo drain plugin)
const httpServer = http.createServer(app);

// ═══════════════════════════════════════════════════════════════════
// HTTP SERVER TIMEOUTS
// Prevents slowloris attacks and socket exhaustion under load.
// keepAliveTimeout should be slightly higher than NLB/proxy idle timeout (60s).
// ═══════════════════════════════════════════════════════════════════
httpServer.keepAliveTimeout = 65000; // 65s - above NLB's 60s idle timeout
httpServer.headersTimeout = 66000;   // Must be > keepAliveTimeout

/**
 * Full server bootstrap: mounts the Apollo GraphQL middleware, initializes
 * supporting services, then starts listening.
 *
 * IMPORTANT: This runs for EVERY process that starts the server — including
 * each cluster worker forked by clusterManager (which imports and calls this
 * function). Previously the Apollo mounting lived behind an
 * `if (process.argv[1] === filename)` guard that was only true when server.js
 * was the DIRECT entry point; under the cluster manager that guard is false,
 * so `/graphql` was never mounted in production → 404 on every GraphQL request.
 */
let bootstrapped = false;

export async function startServer() {
  // Guard against double-bootstrap if startServer is ever called twice.
  if (!bootstrapped) {
    bootstrapped = true;

    // Create Apollo server with httpServer for proper drain handling
    const apolloServer = createApolloServer(httpServer);

    // Apollo must be started before its middleware is mounted
    await apolloServer.start();
    logger.info("Apollo GraphQL server started", {
      endpoint: `${env.BASE_API_ENDPOINT}/graphql`,
    });

    // Mount GraphQL middleware (before listen)
    app.use(
      `${env.BASE_API_ENDPOINT}/graphql`,
      expressMiddleware(apolloServer, {
        context: userRoutesGQLProtectMiddleware,
      }),
    );

    // Initialize ReferralIdService (allocates ID range from Redis)
    await referralIdService.initialize();
    logger.info("ReferralIdService initialized", referralIdService.getRangeInfo());

    // Initialize KyIdService (for KY-2027-XXXXX user IDs)
    await kyIdService.initialize();

    // Clear all application caches on startup (ensures fresh data after deploy)
    await clearAllCachesOnStartup();

    // SEC-001 FIX: Initialize Google OAuth client for server-side token verification
    initializeGoogleOAuthClient(env.GOOGLE_CLIENT_ID);

    // Start BullMQ email worker for async email processing
    startEmailWorker();

    // Graceful shutdown for BullMQ
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received - shutting down gracefully`);
      await stopEmailWorker();
      await closeEmailQueue();
      process.exit(0);
    };
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  }

  return new Promise<http.Server>((resolve) => {
    httpServer.listen(env.HTTP_SERVER_PORT, () => {
      logger.info(`HTTP server listening`, { port: env.HTTP_SERVER_PORT });
      resolve(httpServer);
    });
  });
}

// When server.js is run DIRECTLY (e.g. `nodemon server.js` in dev) rather than
// via the cluster manager, bootstrap + listen here. Under the cluster manager,
// the worker imports startServer() and calls it, so this block is skipped.
const filename = fileURLToPath(import.meta.url);
if (process.argv[1] === filename) {
  await startServer();
}
