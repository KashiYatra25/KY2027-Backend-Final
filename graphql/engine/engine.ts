import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ApolloServer } from "@apollo/server";
import type { ApolloServerPlugin, GraphQLRequestListener, GraphQLRequestContext } from "@apollo/server";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { ApolloServerPluginLandingPageDisabled } from "@apollo/server/plugin/disabled";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import depthLimit from "graphql-depth-limit";
import { type ValidationRule, GraphQLError } from "graphql";
import type { Request } from "express";
import { resolvers } from "@gql/resolver/main.resolver.js";
import { type RoleLevel } from "@lib/prisma/index.js";
import type { Server } from "http";
import { logger } from "@root/lib/logger/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════
// SEC-009 FIX: Disable introspection and landing page in production
// Exposing schema to attackers allows them to understand your API
// ═══════════════════════════════════════════════════════════════════
const isProduction = process.env.NODE_ENV === "production";

// ═══════════════════════════════════════════════════════════════════
// H5 FIX: Query depth limiting + complexity (alias) analysis
// Prevents denial-of-service via deeply-nested or alias-amplified
// queries that explode server-side resolution cost.
// ═══════════════════════════════════════════════════════════════════
const MAX_QUERY_DEPTH = 7;
const MAX_ALIASES = 15;

/**
 * Lightweight complexity guard: rejects operations that use an excessive
 * number of field aliases (a common amplification technique where the same
 * expensive field is requested many times under different alias names).
 */
function maxAliasesRule(maxAliases: number): ValidationRule {
  return (context) => {
    let aliasCount = 0;
    return {
      Field(node) {
        if (node.alias) {
          aliasCount += 1;
          if (aliasCount > maxAliases) {
            context.reportError(
              new GraphQLError(
                `Query uses too many aliases (max ${maxAliases}).`,
                { nodes: [node] },
              ),
            );
          }
        }
      },
    };
  };
}

export type GqlGlobalContext = {
  user: {
    id: string;
    email: string;
    role: RoleLevel;
  } | null;
  req: Request;
};

const schemaPath = path.join(__dirname, "../../../graphql/schema/");
const typeDefs = fs
  .readdirSync(schemaPath)
  .filter((file) => file.endsWith(".graphql") || file.endsWith(".gql"))
  .map((file) => fs.readFileSync(path.join(schemaPath, file), "utf8"));

export function createApolloServer(server: Server) {
  /**
   * Apollo plugin to log GraphQL errors to Loki.
   * Catches validation errors, resolver errors, and other GraphQL-level errors.
   * Includes safe debugging context without PII.
   */
  const errorLoggingPlugin: ApolloServerPlugin<GqlGlobalContext> = {
    async requestDidStart(): Promise<GraphQLRequestListener<GqlGlobalContext>> {
      return {
        async didEncounterErrors(requestContext: GraphQLRequestContext<GqlGlobalContext>) {
          if (!requestContext.errors) return;
          
          const req = requestContext.contextValue?.req;
          const user = requestContext.contextValue?.user;
          
          // Extract variable names (not values) for debugging
          const variableNames = requestContext.request.variables 
            ? Object.keys(requestContext.request.variables)
            : [];
          
          for (const error of requestContext.errors) {
            const code = error.extensions?.code as string | undefined;
            
            // Build log context - safe info only, no PII
            const logContext: Record<string, unknown> = {
              requestId: req?.requestId || "none",
              userId: user?.id || "anonymous",
              operationName: requestContext.request.operationName,
              code,
              path: error.path,
              error: error.message,
              variableNames, // Shows WHAT was passed, not the values
            };

            // Include stack trace for server errors (not validation errors)
            if (code !== "GRAPHQL_VALIDATION_FAILED" && error.extensions?.stacktrace) {
              logContext.stack = error.extensions.stacktrace;
            }

            // Log level based on error type
            if (code === "GRAPHQL_VALIDATION_FAILED") {
              // Schema mismatch - usually frontend needs update
              logger.warn("GraphQL validation error", logContext);
            } else if (code === "INTERNAL_SERVER_ERROR") {
              logger.error("GraphQL internal error", logContext);
            } else {
              // Other errors (auth, forbidden, bad request)
              logger.warn("GraphQL error", logContext);
            }
          }
        },
      };
    },
  };

  return new ApolloServer({
    typeDefs,
    resolvers,
    // SEC-009: Disable introspection in production
    introspection: !isProduction,
    // H5 FIX: enforce query depth + alias/complexity limits
    validationRules: [depthLimit(MAX_QUERY_DEPTH), maxAliasesRule(MAX_ALIASES)],
    plugins: [
      errorLoggingPlugin,
      ApolloServerPluginDrainHttpServer({ httpServer: server }),
      // SEC-009: Disable landing page in production
      isProduction
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });
}
