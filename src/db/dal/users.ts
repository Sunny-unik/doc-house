import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}) {
  const [user] = await db
    .insert(users)
    .values(input)
    .returning({ id: users.id, email: users.email, name: users.name });
  return user;
}
