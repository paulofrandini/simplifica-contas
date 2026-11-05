import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("A variável DATABASE_URL não foi configurada.");
  }

  const client = postgres(connectionString, {
    max: 1,
    prepare: false,
    ssl: "require",
    idle_timeout: 20,
    connect_timeout: 15,
  });

  return drizzle(client, { schema });
}

let database: ReturnType<typeof createDatabase> | null = null;

export function getDb() {
  if (database) return database;

  database = createDatabase();
  return database;
}
