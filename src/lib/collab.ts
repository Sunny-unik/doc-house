import * as Y from "yjs";

// Shared Yjs collaboration constants and helpers — used by the client editor
// and by the server-side document materialization. These MUST stay identical on
// both sides or the CRDT state won't line up.

// The Yjs XML fragment Tiptap's Collaboration extension binds to (its default).
export const YJS_FRAGMENT = "default";

// IndexedDB database name for a document's local Y.Doc.
export function localDocKey(documentId: string) {
  return `dochouse-doc-${documentId}`;
}

// Flatten a document to plain text, one line per block node.
//
// Deliberately hand-rolled rather than reusing the headless-Tiptap round-trip
// that VersionHistoryPanel does: that needs `document.createElement`, and the
// changes API has to produce the same text on the server, where there's no DOM.
// Both sides calling this means a diff computed server-side and one computed
// client-side are directly comparable.
export function docText(doc: Y.Doc): string {
  const out = { text: "" };
  walk(doc.getXmlFragment(YJS_FRAGMENT), out);
  // Nested blocks (a list item's paragraph, say) each contribute a newline on
  // the way out, so collapse the resulting runs down to one blank line.
  return out.text.replace(/\n{3,}/g, "\n\n").trim();
}

function walk(node: Y.XmlFragment | Y.XmlElement, out: { text: string }) {
  for (const child of node.toArray()) {
    if (child instanceof Y.XmlText) {
      out.text += plainText(child);
    } else if (child instanceof Y.XmlElement) {
      if (child.nodeName === "hardBreak") {
        out.text += "\n";
        continue;
      }
      // Every other element is a block node: in the Tiptap schema inline
      // formatting rides on Y.XmlText attributes, never on its own element.
      walk(child, out);
      out.text += "\n";
    }
  }
}

function plainText(node: Y.XmlText): string {
  return node
    .toDelta()
    .map((part: { insert?: unknown }) => (typeof part.insert === "string" ? part.insert : ""))
    .join("");
}
