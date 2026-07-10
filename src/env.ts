import { z } from "zod";

// Validate environment variables once, at import time, so a misconfigured
// deploy fails loudly instead of throwing deep inside a request handler.
// Keys are added here as each checkpoint starts needing them.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Neon connection string)"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
