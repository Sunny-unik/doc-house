import { google } from "@ai-sdk/google";
import { generateText } from "ai";

// The AI SDK reads GOOGLE_GENERATIVE_AI_API_KEY from process.env automatically;
// exposing a helper keeps the check next to the callers instead of buried in
// each route handler.
export function isAiConfigured() {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

// The `-latest` aliases follow Google's current-generation flash tier so we
// don't have to chase model deprecations every quarter. Bump to
// `gemini-pro-latest` if you want higher quality at the cost of latency and
// spend, or pin to a specific version (e.g. `gemini-3.5-flash`) for
// reproducibility across environments.
const MODEL = "gemini-flash-latest";

export async function summarizeDocument(content: string): Promise<string> {
  const { text } = await generateText({
    model: google(MODEL),
    system: [
      "You are a careful writing assistant embedded in a document editor.",
      "Summarise the user's document in 2-4 sentences.",
      "Stay faithful to what's written. Do not invent facts, add opinions, or address the reader.",
      "Match the document's tone. Return plain text only, no headings or lists.",
    ].join(" "),
    prompt: content,
  });
  return text.trim();
}

export async function suggestDocumentTitle(content: string): Promise<string> {
  const { text } = await generateText({
    model: google(MODEL),
    system: [
      "You suggest concise document titles.",
      "Given the document below, propose exactly ONE title of 3-8 words that captures its main subject.",
      "Return only the title text — no quotes, no leading label, no trailing punctuation, no explanation.",
    ].join(" "),
    prompt: content,
  });
  return text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?…]+$/, "")
    .slice(0, 200);
}
