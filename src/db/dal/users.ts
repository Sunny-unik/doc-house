import { randomBytes, randomUUID } from "node:crypto";
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

// A reserved domain for synthetic guest addresses. `.invalid` is set aside by
// RFC 2606 precisely so it can never resolve — nobody can ever receive mail here
// or register a matching account through the normal signup form.
const GUEST_EMAIL_DOMAIN = "guests.dochouse.invalid";

/**
 * Create the user row behind a share-link guest.
 *
 * Guests are real rows rather than a parallel concept, because `createdBy` on
 * DocumentUpdate and VersionSnapshot are NOT NULL foreign keys to User — a guest
 * who types a character has to resolve to a user or the sync insert fails. Giving
 * them a row means membership, authz, and the viewer-cannot-push rule all keep
 * working untouched.
 */
export async function createGuestUser(name: string) {
  const [user] = await db
    .insert(users)
    .values({
      email: `guest-${randomUUID()}@${GUEST_EMAIL_DOMAIN}`,
      name,
      // Random and colon-free, so verifyPassword's "salt:key" split fails before
      // it ever compares anything. There is no password that unlocks this row —
      // a guest session can only ever be minted by redeeming a valid link.
      passwordHash: randomBytes(32).toString("hex"),
      isGuest: true,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      isGuest: users.isGuest,
    });
  return user;
}
