// Defensive JSON body reader for API routes.
//
// The threat we're defending against: a malicious client sends a payload that
// looks structurally valid but is *massive* — either to blow through memory
// (OOM the server) or to keep the request thread busy long enough to starve
// other work. `req.json()` will happily buffer the entire body into memory
// before we can validate it, so we have to intervene before that call.
//
// The strategy: check `content-length` first (cheap), then read the body as a
// bounded stream so we can bail out the moment we exceed the cap. Whatever is
// left over is parsed with `JSON.parse` inside a try/catch so a corrupt body
// becomes a 400, never a 500.

export type PayloadResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 413; error: string };

export async function parseJsonBody<T = unknown>(
  request: Request,
  { maxBytes }: { maxBytes: number },
): Promise<PayloadResult<T>> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    return { ok: false, status: 413, error: "Payload too large" };
  }

  const body = request.body;
  if (!body) {
    return { ok: false, status: 400, error: "Missing body" };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* stream already gone */
        }
        return { ok: false, status: 413, error: "Payload too large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "Failed to read body" };
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder("utf-8").decode(merged);

  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
}
