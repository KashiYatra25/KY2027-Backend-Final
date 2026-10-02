import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import type { Request } from "express";
import { resolvers } from "@gql/resolver/main.resolver.js";
import { type RoleLevel } from "@lib/prisma/index.js";
import type { Server } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    introspection: true,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer: server }),
      ApolloServerPluginLandingPageLocalDefault({
        embed: true,
      }),
    ],
  });
}
