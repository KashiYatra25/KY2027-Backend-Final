import http from "http";
import { app } from "@app/app.js";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/index.js";
import { createApolloServer } from "@root/graphql/engine/engine";
import { fileURLToPath } from "url";
import { expressMiddleware } from "@as-integrations/express5";
import { graphQLContextMiddleware } from "@root/controller/middleware/protect/protect.route.factory.middleware";
import { referralIdService } from "@root/services/referral/index.js";

// Create HTTP server from Express app (required for Apollo drain plugin)
const httpServer = http.createServer(app);

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
  logger.info("Apollo GraphQL server started", { endpoint: `${env.BASE_API_ENDPOINT}/graphql` });

  // Add GraphQL middleware
  app.use(
    `${env.BASE_API_ENDPOINT}/graphql`,
    expressMiddleware(apolloServer, {
      context: graphQLContextMiddleware,
    }),
  );

  // Initialize ReferralIdService (allocates ID range from Redis)
  await referralIdService.initialize();
  logger.info("ReferralIdService initialized", referralIdService.getRangeInfo());

  // Now start listening
  await startServer();
}
