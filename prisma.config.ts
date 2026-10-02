import dotenv from "dotenv";
import path from "node:path";
import type { PrismaConfig } from "prisma";
import { env } from "./lib/env/environment.js";

export default {
  schema: path.join(__dirname, "databaseManagers", "prisma", "schemas"),

  migrations: {
    path: path.join(__dirname, "databaseManagers", "prisma", "migrations"),
  },

  datasource: {
    url: env.DATABASE_URL,
  },
} satisfies PrismaConfig;