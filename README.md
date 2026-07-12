# docHouse

A local-first, collaborative document editor. Edit while offline, come back online, and your work is merged deterministically without losing anything. Snapshot the doc anytime and roll back to any past version safely.

Built as the fullstack developer assignment for House of Edtech.

## Live demo

_TBD — deployment link goes here once the Vercel project is up._

## Highlights

- **Local-first editing.** Every keystroke is written to a per-document IndexedDB store before the network is touched. You can open, close, and edit any document you've visited without a connection.
- **Deterministic offline sync.** Edits made while offline are queued and replayed to the server on reconnect via an append-only Yjs update log, so concurrent edits from multiple people merge cleanly with no last-writer-wins loss.
- **Background snapshot prefetch.** When you land on the document list, each doc's Yjs state is pulled into IndexedDB in the background — so opening any listed doc is instant and works offline too.
- **Version history.** Save labelled snapshots at any point. Preview a snapshot's content in a read-only modal, or restore it — restore is expressed as a new revision, so history is never destroyed and collaborators receive the restore through the normal sync channel.
- **Roles and sharing.** Owners can invite by email and change or revoke access. Editors can write and leave. Viewers can read and leave. Viewers are blocked at the API layer, not just in the UI — a downgraded editor's client discards local edits and reloads from the server's canonical state.
- **AI assistant.** Powered by Gemini via the Vercel AI SDK: summarise the current document, or ask for a title suggestion and apply it in one click.
- **Server-side hardening.** Every write endpoint enforces a body-size cap read as a bounded stream (no OOM on huge payloads), Zod-validates the schema, and is rate-limited per user. Malformed Yjs updates come back as 400, not 500.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **TypeScript** end-to-end
- **Tailwind CSS v4** with a dark-first UI
- **PostgreSQL** on Neon, via **Drizzle ORM** (`@neondatabase/serverless` HTTP driver)
- **Auth.js v5** (Credentials + JWT sessions)
- **Yjs** + **Tiptap 3** (`@tiptap/starter-kit`, `@tiptap/extension-collaboration`), with `y-indexeddb` for local persistence
- **Vercel AI SDK** (`ai`, `@ai-sdk/google`) for Gemini calls
- **Zod** for input validation
- In-memory sliding-window rate limiter (per-process — swap to Upstash for horizontal scale)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — Neon pooled connection string
- `AUTH_SECRET` — generate with `npx auth secret`
- `GOOGLE_GENERATIVE_AI_API_KEY` — optional. Only the AI assistant panel needs it; the rest of the app runs without it. Free-tier keys work fine ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)).

### 3. Apply the database schema

```bash
npm run db:push
```

This creates the `User`, `Document`, `DocumentMembership`, `DocumentUpdate`, and `VersionSnapshot` tables.

### 4. Run

```bash
npm run dev       # dev with Turbopack HMR
npm run build && npm run start   # production build
```

Then visit [http://localhost:3000](http://localhost:3000), register an account, and start writing.

### 5. Tests

```bash
npm test          # runs the vitest suite once
```

Coverage is focused on the pure-logic core the assignment explicitly asks about — the append-only sync engine (`materializeDoc`, CRDT convergence, concurrent-edit merging), the bounded-stream payload guard that stops OOM attacks, and the sliding-window rate limiter. Full API + editor integration coverage is intentionally out of scope for this iteration.

## Architecture notes

### Sync engine

The client debounces local Yjs updates by ~1.2 s, then POSTs `{ update, stateVector }` to `/api/documents/[id]/sync`. The server rebuilds the canonical Y.Doc from the append-only `DocumentUpdate` log, applies the client's update, and — only if the state actually advanced — appends the diff as a new log entry. It replies with whatever the client is missing based on its state vector. That's a full push+pull round trip in one request, with no log growth on no-op syncs.

### Roles enforced at the DAL

Every doc read joins through `DocumentMembership.userId`, so tenant isolation happens at the ORM layer — nothing above it needs to remember to filter by user. Role-scoped writes (`sync`, member management) go through a small `requireDocRole` helper that returns 403 for wrong-role members and 404 for non-members, so we don't leak the existence of a doc.

### Offline mutations

`create` / `rename` / `delete` are optimistically applied to the client's IndexedDB list cache and enqueued in an outbox object store. An `OutboxFlusher` listens for the `online` event and replays them through server actions that are idempotent (`onConflictDoNothing` on inserts, no-op on missing rows for deletes), so a partial replay is safe to retry.

### Version history

Snapshots store the raw Yjs state at a point in time along with `upToUpdateId` (the log cursor at snapshot time), making each row self-describing. Restore materialises the snapshot in a headless Tiptap editor bound to a throwaway Y.Doc, extracts prosemirror JSON, and calls `setContent` on the live editor. Because the live editor is bound to the shared Y.Doc via `@tiptap/extension-collaboration`, the restore is expressed as normal Yjs ops that propagate through the sync pipeline — the append-only log is never rewritten and other collaborators see the restore as a regular edit.

### Configured limits

Every write endpoint applies a body-size cap (bounded-stream read → 413 on overflow) and a per-user sliding-window rate limit (→ 429 with `Retry-After` on overflow). All numbers live next to their constants in code — this table is the single-glance reference:

| Endpoint | Body cap | Rate limit | Bucket key |
|---|---|---|---|
| `POST /api/documents/[id]/sync` | 4 MB envelope, 1.5 MB per base64 field (≈1.1 MB binary) | 120 / 60 s | `sync:<userId>` |
| `POST /api/documents/[id]/versions` | 4 MB envelope, 6 MB base64 field, 200-char label | 30 / 60 s | `snap:<userId>` |
| `POST /api/documents/[id]/members` (invite) | 4 KB envelope, 254-char email | 30 / 60 s | `members:<userId>` |
| `PATCH /api/documents/[id]/members/[userId]` (role change) | 1 KB envelope | shares `members:<userId>` bucket | same as above |
| `DELETE /api/documents/[id]/members/[userId]` (revoke / leave) | no body | shares `members:<userId>` bucket | same as above |
| `POST /api/documents/[id]/ai/summarize` | 200 KB envelope, 100 000-char content | 20 / 60 s | `ai:<userId>` (shared with title) |
| `POST /api/documents/[id]/ai/suggest-title` | 200 KB envelope, 100 000-char content | shares `ai:<userId>` bucket | same as above |

Other shipping limits:

- **Document list pagination** — `DOCS_PAGE_SIZE = 5` documents per page (`src/db/dal/documents.ts`).
- **Editor sync debounce** — `1200 ms` of typing silence before a client push (`src/components/editor/useDocProvider.ts`). The keystrokes themselves are always instant; only the server round-trip waits.

### Payload defence

`src/lib/security/payload.ts` reads request bodies as a bounded stream instead of buffering with `req.json()`. If either the declared `content-length` or the actual received bytes exceed the route's cap, we abort the read and return 413 immediately — the process never allocates the full payload. Combined with tight Zod max-length constraints on the parsed schema, that closes the OOM door.

## Author

Built by Sunny Gandhwani — [GitHub](https://github.com/sunny-unik) · [LinkedIn](https://www.linkedin.com/in/sunny-gandhwani)
