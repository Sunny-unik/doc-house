import { describe, expect, it } from "vitest";
import { parseJsonBody } from "./payload";

function makeRequest(body: BodyInit, headers: Record<string, string> = {}) {
  return new Request("http://localhost/test", {
    method: "POST",
    body,
    headers,
  });
}

describe("parseJsonBody", () => {
  it("returns parsed JSON when the body fits within the cap", async () => {
    const req = makeRequest(JSON.stringify({ hello: "world" }));
    const result = await parseJsonBody<{ hello: string }>(req, { maxBytes: 1000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.hello).toBe("world");
  });

  it("rejects with 413 when content-length declares an oversize payload", async () => {
    // The header alone is enough to bail out — no bytes need to hit the reader.
    const req = makeRequest("small", { "content-length": "9999" });
    const result = await parseJsonBody(req, { maxBytes: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it("rejects with 413 when the actual body exceeds the cap even if content-length is missing", async () => {
    // This is the important malicious-client case: attacker either omits or
    // lies about content-length and streams data. We must catch it mid-stream.
    const big = "x".repeat(2000);
    const req = makeRequest(big);
    const result = await parseJsonBody(req, { maxBytes: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it("rejects with 400 when the body is not valid JSON", async () => {
    const req = makeRequest("{ not valid json");
    const result = await parseJsonBody(req, { maxBytes: 1000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("preserves the exact structure of a nested payload", async () => {
    const payload = { user: { id: "abc", tags: ["a", "b"] }, count: 42 };
    const req = makeRequest(JSON.stringify(payload));
    const result = await parseJsonBody<typeof payload>(req, { maxBytes: 4_000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(payload);
  });
});
