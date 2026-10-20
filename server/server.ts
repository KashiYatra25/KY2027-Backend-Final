import http from "http";
import { app } from "@app/app.js";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import { createApolloServer } from "@root/graphql/engine/engine";
import { fileURLToPath } from "url";
import { expressMiddleware } from "@as-integrations/express5";
import { userRoutesGQLProtectMiddleware } from "@root/middleware/user/protect/index.js";
import { referralIdService } from "@root/services/referral/index.js";
import { initializeGoogleOAuthClient } from "@services/google/googleOAuth.service.js";
import {
  startEmailWorker,
  stopEmailWorker,
  closeEmailQueue,
} from "@services/queue/index.js";

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
 * Starts the HTTP server with proper Apollo integration
 */
export function startServer() {
  return new Promise<http.Server>((resolve) => {
    httpServer.listen(env.HTTP_SERVER_PORT, () => {
      logger.info(`HTTP server listening`, { port: env.HTTP_SERVER_PORT });
      resolve(httpServer);
    });
  });
}

const filename = fileURLToPath(import.meta.url);
if (process.argv[1] === filename) {
  // Create Apollo server with httpServer for proper drain handling
  const apolloServer = createApolloServer(httpServer);

  // Start Apollo server first
  await apolloServer.start();
  logger.info("Apollo GraphQL server started", {
    endpoint: `${env.BASE_API_ENDPOINT}/graphql`,
  });

  // Add GraphQL middleware
  app.use(
    `${env.BASE_API_ENDPOINT}/graphql`,
    expressMiddleware(apolloServer, {
      context: userRoutesGQLProtectMiddleware,
    }),
  );

  // Initialize ReferralIdService (allocates ID range from Redis)
  await referralIdService.initialize();
  logger.info(
    "ReferralIdService initialized",
    referralIdService.getRangeInfo(),
  );

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

  // Now start listening
  await startServer();
}
