import {
  bigint,
  boolean,
  customType,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Postgres `bytea` column. We work with Uint8Array in app code (what Yjs
// produces/consumes) and let the driver hand us a Buffer at the boundary.
// NOTE(CP6): confirm the Neon driver actually returns a Buffer here before
// building the sync round-trip on top of it.
const bytea = customType<{ data: Uint8Array; driverData: Buffer | string }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return Buffer.from(value);
  },
  fromDriver(value) {
    // We override Neon's bytea parser (see db/index.ts), so reads arrive as a
    // hex string like "\\x0102". Fall back to Buffer for other drivers/tests.
    if (typeof value === "string") {
      const hex = value.startsWith("\\x") ? value.slice(2) : value;
      return Uint8Array.from(Buffer.from(hex, "hex"));
    }
    return new Uint8Array(value);
  },
});

export const docRole = pgEnum("DocRole", ["owner", "editor", "viewer"]);
export type DocRole = (typeof docRole.enumValues)[number];

export const users = pgTable("User", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("passwordHash").notNull(),
  // Someone who arrived through a share link instead of registering. They get a
  // real row so that every `createdBy` foreign key keeps working — the whole
  // membership/authz stack then treats them like any other user, with no
  // parallel "maybe it's a guest" branch anywhere. Their email is synthetic and
  // their passwordHash is deliberately unusable, so they can never sign in
  // through the credentials form.
  isGuest: boolean("isGuest").notNull().default(false),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("Document", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("ownerId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const documentMemberships = pgTable(
  "DocumentMembership",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: docRole("role").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // one membership row per (document, user)
    uniqueIndex("DocumentMembership_documentId_userId_key").on(t.documentId, t.userId),
    // "list every doc a user can see" is a hot query
    index("DocumentMembership_userId_idx").on(t.userId),
  ],
);

// Append-only log of Yjs updates. The identity `id` gives every update a
// strict total order per document — the cursor the sync engine reads from.
export const documentUpdates = pgTable(
  "DocumentUpdate",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    documentId: uuid("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    update: bytea("update").notNull(),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("DocumentUpdate_documentId_id_idx").on(t.documentId, t.id)],
);

// A shareable link that grants access to one document without an account.
//
// The token is stored as-is rather than hashed, and that's a considered call:
// unlike a password, this token is meant to be re-read and re-copied by the
// owner long after it's minted, so a one-way hash would mean "generate a new
// link every time you want to send it". The threat model differs too — a hash
// protects a password because users reuse passwords elsewhere, whereas anyone
// who has read access to this table already has read access to the documents
// themselves, so hashing would buy nothing here.
export const shareLinks = pgTable(
  "ShareLink",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    // Only ever "editor" or "viewer" — a link can't hand out ownership. The
    // enum is shared with memberships, so the API validates the narrow set.
    role: docRole("role").notNull(),
    // Null means the link never expires.
    expiresAt: timestamp("expiresAt", { withTimezone: true }),
    // Soft-revoke: we keep the row so an old link resolves to "revoked" rather
    // than the indistinguishable "never existed", and so the audit trail of who
    // shared what survives.
    revokedAt: timestamp("revokedAt", { withTimezone: true }),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ShareLink_documentId_idx").on(t.documentId)],
);

export const versionSnapshots = pgTable(
  "VersionSnapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    snapshot: bytea("snapshot").notNull(),
    // the log position this snapshot was taken at
    upToUpdateId: bigint("upToUpdateId", { mode: "bigint" }).notNull(),
    label: text("label").notNull(),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("VersionSnapshot_documentId_createdAt_idx").on(t.documentId, t.createdAt.desc())],
);
