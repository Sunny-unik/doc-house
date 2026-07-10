import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/env";
import * as schema from "./schema";

// Neon's HTTP driver: each query is a stateless fetch, which suits Vercel's
// serverless functions. Interactive transactions aren't available over HTTP;
// if a later checkpoint needs one, we switch to the WebSocket Pool driver.
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
