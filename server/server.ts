import http from "http";
import { app } from "@app/app.js";
import { env } from "@lib/env/environment.js";
import { createApolloServer } from "@root/graphql/engine/engine";
import { fileURLToPath } from "url";
import { expressMiddleware } from "@as-integrations/express5";
import { graphQLContextMiddleware } from "@root/middleware/protect/protect.factory.middleware";

// Create HTTP server from Express app (required for Apollo drain plugin)
const httpServer = http.createServer(app);

/**
 * Starts the HTTP server with proper Apollo integration
 */
export function startServer() {
  return new Promise<http.Server>((resolve) => {
    httpServer.listen(env.HTTP_SERVER_PORT, () => {
      console.log(
        `Server is running on http://localhost:${env.HTTP_SERVER_PORT || 6000}`,
      );
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
  
  // Add GraphQL middleware
  app.use(
    `${env.BASE_API_ENDPOINT}/graphql`,
    expressMiddleware(apolloServer, {
      context: graphQLContextMiddleware,
    }),
  );
  
  // Now start listening
  await startServer();
}
