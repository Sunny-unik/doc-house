"use client";

import { type Editor, useEditorState } from "@tiptap/react";
import { cn } from "@/lib/cn";

export function Toolbar({ editor }: { editor: Editor }) {
  // Recompute active marks/nodes on each transaction so button highlights track
  // the selection (Tiptap v3's useEditor doesn't re-render on its own).
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
      code: editor.isActive("codeBlock"),
    }),
  });

  const buttons = [
    { label: "Bold", hint: "Bold (Ctrl+B)", on: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", hint: "Italic (Ctrl+I)", on: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { divider: true },
    { label: "H1", hint: "Heading 1", on: state.h1, run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "H2", hint: "Heading 2", on: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { divider: true },
    { label: "• List", hint: "Bullet list", on: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "1. List", hint: "Numbered list", on: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Quote", hint: "Blockquote", on: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "Code", hint: "Code block", on: state.code, run: () => editor.chain().focus().toggleCodeBlock().run() },
  ] as const;

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex flex-wrap items-center gap-0.5 rounded-lg border border-line bg-surface p-1"
    >
      {buttons.map((item, i) =>
        "divider" in item ? (
          <span key={i} aria-hidden className="mx-1 h-5 w-px bg-line" />
        ) : (
          <button
            key={item.label}
            type="button"
            // aria-pressed is what tells a screen reader the mark is currently
            // on — the colour change alone says nothing.
            aria-pressed={item.on}
            title={item.hint}
            onClick={item.run}
            className={cn(
              "rounded-md px-2 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              item.on
                ? "bg-accent text-accent-fg"
                : "text-text-muted hover:bg-surface-muted hover:text-text",
            )}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
