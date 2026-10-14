import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: Db;
  kind: "pglite" | "postgres";
  migrate(): Promise<void>;
  close(): Promise<void>;
}

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

export interface OpenDbOptions {
  /** postgres:// URL. If absent, embedded Postgres (PGlite) is used. */
  url?: string;
  /** Directory for PGlite data. Use "memory://" for an in-memory database (tests). */
  dataDir?: string;
}

export async function openDb(opts: OpenDbOptions = {}): Promise<DbHandle> {
  if (opts.url && /^postgres(ql)?:\/\//.test(opts.url)) {
    const sql = postgres(opts.url, { max: 10, onnotice: () => {} });
    const db = drizzlePostgres(sql, { schema }) as unknown as Db;
    return {
      db,
      kind: "postgres",
      migrate: () => migratePostgres(drizzlePostgres(sql), { migrationsFolder }),
      close: () => sql.end(),
    };
  }
  const dataDir = opts.dataDir ?? ".adlab/pglite";
  if (!dataDir.startsWith("memory://")) mkdirSync(path.resolve(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  await client.waitReady;
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  return {
    db,
    kind: "pglite",
    migrate: () => migratePglite(drizzlePglite(client), { migrationsFolder }),
    close: () => client.close(),
  };
}
