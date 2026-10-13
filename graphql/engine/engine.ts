import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { ApolloServerPluginLandingPageDisabled } from "@apollo/server/plugin/disabled";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import depthLimit from "graphql-depth-limit";
import { type ValidationRule, GraphQLError } from "graphql";
import type { Request } from "express";
import { resolvers } from "@gql/resolver/main.resolver.js";
import { type RoleLevel } from "@lib/prisma/index.js";
import type { Server } from "http";

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
  return new ApolloServer({
    typeDefs,
    resolvers,
    // SEC-009: Disable introspection in production
    introspection: !isProduction,
    // H5 FIX: enforce query depth + alias/complexity limits
    validationRules: [depthLimit(MAX_QUERY_DEPTH), maxAliasesRule(MAX_ALIASES)],
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer: server }),
      // SEC-009: Disable landing page in production
      isProduction
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });
}
