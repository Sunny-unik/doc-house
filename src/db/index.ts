import { neon, types } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/env";
import * as schema from "./schema";

// Neon's built-in bytea parser uses the deprecated `new Buffer()`, which throws
// on some Node versions (e.g. 22.3). Override it to return the raw hex string;
// our `bytea` customType in schema.ts decodes it with Buffer.from. OID 17 = bytea.
types.setTypeParser(17, (value) => value);

// Neon's HTTP driver: each query is a stateless fetch, which suits Vercel's
// serverless functions. Interactive transactions aren't available over HTTP;
// if a later checkpoint needs one, we switch to the WebSocket Pool driver.
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
