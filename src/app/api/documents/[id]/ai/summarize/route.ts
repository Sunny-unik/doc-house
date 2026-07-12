import { z } from "zod";
import { auth } from "@/auth";
import { getMembershipRole } from "@/db/dal/documents";
import { isAiConfigured, summarizeDocument } from "@/lib/ai/gemini";
import { parseJsonBody } from "@/lib/security/payload";
import { rateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";

// 100 KB of prose is more than an average human document; anything larger is
// almost certainly a paste-bomb we don't want to spend AI budget on.
const MAX_INPUT_CHARS = 100_000;
const MAX_BYTES = 200_000;
const AI_RATE = { limit: 20, windowMs: 60_000 } as const;

const schema = z.object({
  content: z.string().trim().min(1).max(MAX_INPUT_CHARS),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isAiConfigured()) {
    return Response.json({ error: "AI is not configured on this server." }, { status: 501 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`ai:${session.user.id}`, AI_RATE);
  if (!rl.ok) return tooManyRequestsResponse(rl);

  const role = await getMembershipRole(id, session.user.id);
  if (!role) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody(req, { maxBytes: MAX_BYTES });
  if (!body.ok) return Response.json({ error: body.error }, { status: body.status });

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const summary = await summarizeDocument(parsed.data.content);
    return Response.json({ summary });
  } catch {
    return Response.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }
}
