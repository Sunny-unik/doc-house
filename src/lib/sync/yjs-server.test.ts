import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { bytesEqual, materializeDoc } from "./yjs-server";

describe("bytesEqual", () => {
  it("returns true for identical byte sequences", () => {
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
  });

  it("returns false when lengths differ", () => {
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it("returns false when contents differ at any position", () => {
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
  });

  it("treats two empty arrays as equal", () => {
    expect(bytesEqual(new Uint8Array(), new Uint8Array())).toBe(true);
  });
});

describe("materializeDoc", () => {
  it("returns a valid empty document when no updates are supplied", () => {
    const doc = materializeDoc([]);
    // An empty Yjs doc still emits a non-empty state vector — this proves the
    // return value is a live doc rather than a no-op.
    expect(Y.encodeStateVector(doc).length).toBeGreaterThan(0);
    doc.destroy();
  });

  it("replays sequential updates into the final document state", () => {
    const source = new Y.Doc();
    const text = source.getText("t");

    text.insert(0, "hello");
    const update1 = Y.encodeStateAsUpdate(source);

    text.insert(5, " world");
    const update2 = Y.encodeStateAsUpdate(source);

    const materialized = materializeDoc([update1, update2]);
    expect(materialized.getText("t").toString()).toBe("hello world");

    source.destroy();
    materialized.destroy();
  });

  it("converges to the same document regardless of update replay order", () => {
    // The append-only sync log guarantees that any prefix of updates a client
    // is missing will produce the same doc as the server has. This test locks
    // in the CRDT invariant we rely on for deterministic conflict resolution.
    const source = new Y.Doc();
    const text = source.getText("t");

    text.insert(0, "a");
    const u1 = Y.encodeStateAsUpdate(source);
    text.insert(1, "b");
    const u2 = Y.encodeStateAsUpdate(source);

    const forward = materializeDoc([u1, u2]);
    const reverse = materializeDoc([u2, u1]);

    expect(forward.getText("t").toString()).toBe(reverse.getText("t").toString());

    forward.destroy();
    reverse.destroy();
    source.destroy();
  });

  it("merges concurrent updates from independent sources without loss", () => {
    // Simulate two clients editing offline simultaneously. Both edits must
    // survive materialization — this is the property that stops sync from
    // becoming last-writer-wins.
    const client1 = new Y.Doc();
    client1.getText("t").insert(0, "hello");
    const update1 = Y.encodeStateAsUpdate(client1);

    const client2 = new Y.Doc();
    client2.getText("t").insert(0, "world");
    const update2 = Y.encodeStateAsUpdate(client2);

    const merged = materializeDoc([update1, update2]);
    const finalText = merged.getText("t").toString();

    // Both fragments must appear somewhere in the merged output.
    expect(finalText).toContain("hello");
    expect(finalText).toContain("world");

    client1.destroy();
    client2.destroy();
    merged.destroy();
  });
});
