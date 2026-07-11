"use client";

import { type Editor, useEditorState } from "@tiptap/react";

const base = "rounded px-2 py-1 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800";
const active = "bg-zinc-200 dark:bg-zinc-700";

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

  const cls = (on: boolean) => `${base} ${on ? active : ""}`;
  const divider = <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />;

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
      <button type="button" className={cls(state.bold)} onClick={() => editor.chain().focus().toggleBold().run()}>
        Bold
      </button>
      <button type="button" className={cls(state.italic)} onClick={() => editor.chain().focus().toggleItalic().run()}>
        Italic
      </button>
      {divider}
      <button type="button" className={cls(state.h1)} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        H1
      </button>
      <button type="button" className={cls(state.h2)} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </button>
      {divider}
      <button type="button" className={cls(state.bullet)} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • List
      </button>
      <button type="button" className={cls(state.ordered)} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. List
      </button>
      <button type="button" className={cls(state.quote)} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        Quote
      </button>
      <button type="button" className={cls(state.code)} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        Code
      </button>
    </div>
  );
}
