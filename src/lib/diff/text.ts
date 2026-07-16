// Word-level text diff, shared by both sides of the changes view: the server
// uses it to describe each entry in the synced history, the client uses it to
// show what's still waiting to sync. Pure string work — no Yjs, no DOM.

export type DiffOp = { type: "equal" | "add" | "remove"; text: string };

// Split into words *and* the whitespace between them, keeping both as tokens so
// the ops can be concatenated straight back into readable text.
//
// Whitespace stays a token of its own rather than riding along with a word.
// Gluing it to the neighbouring word looks tidier but silently breaks the most
// common edit there is: appending. "dog." and "dog. " are different tokens, so
// typing a new sentence would report the previous last word as deleted and
// re-added. mergeChangeRegions below cleans up what this costs.
function tokenize(text: string): string[] {
  return text.length === 0 ? [] : text.split(/(\s+)/).filter((t) => t.length > 0);
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

// Ceiling on the LCS table, applied per side *after* the common prefix and
// suffix are peeled off. A real edit leaves a handful of differing tokens, so
// this is never hit in practice — it's here because the table is O(n*m), and
// two 1200-token sides is already ~5.7 MB. Past that we report the changed
// region as one block replacement: still accurate, just not word-precise.
const MAX_LCS_TOKENS = 1200;

export function diffWords(before: string, after: string): DiffOp[] {
  const a = tokenize(before);
  const b = tokenize(after);

  // Matching runs at the head and tail are the overwhelmingly common case for a
  // document edit. Peeling them off first is what keeps the table small enough
  // to build at all.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  const ops: DiffOp[] = [];
  const push = (type: DiffOp["type"], text: string) => {
    if (text.length === 0) return;
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += text;
    else ops.push({ type, text });
  };

  push("equal", a.slice(0, start).join(""));

  if (midA.length > MAX_LCS_TOKENS || midB.length > MAX_LCS_TOKENS) {
    push("remove", midA.join(""));
    push("add", midB.join(""));
  } else {
    for (const op of lcsDiff(midA, midB)) push(op.type, op.text);
  }

  push("equal", a.slice(endA).join(""));
  return mergeChangeRegions(ops);
}

// Pull each run of changes into one removed phrase followed by one added phrase.
//
// Because whitespace is its own token, it matches *everything* — so when several
// consecutive words are replaced, the LCS anchors on the spaces between them and
// alternates: remove("old") add("new") equal(" ") remove("words") add("here").
// Minimal, and unreadable: it renders as del/ins confetti. Absorbing the
// whitespace that sits between two changes into both sides says the same thing
// as one strikethrough and one insertion.
function mergeChangeRegions(ops: DiffOp[]): DiffOp[] {
  const isChange = (op: DiffOp | undefined) => op !== undefined && op.type !== "equal";
  // An untouched run only counts as a gap if it's whitespace with a change on
  // each side. Anything else is real context and has to stay put.
  const isGap = (i: number) =>
    ops[i].type === "equal" &&
    ops[i].text.trim().length === 0 &&
    isChange(ops[i - 1]) &&
    isChange(ops[i + 1]);

  const out: DiffOp[] = [];
  let i = 0;
  while (i < ops.length) {
    if (!isChange(ops[i])) {
      out.push(ops[i]);
      i++;
      continue;
    }

    let end = i;
    while (end < ops.length && (isChange(ops[end]) || isGap(end))) end++;
    const region = ops.slice(i, end);

    // The gaps belong to both sides, so each side takes the ops that aren't the
    // other side's. Guard on the region actually containing that kind of change:
    // without it, a region of pure additions would emit the gaps as a deletion.
    if (region.some((op) => op.type === "remove")) {
      out.push({
        type: "remove",
        text: region.filter((op) => op.type !== "add").map((op) => op.text).join(""),
      });
    }
    if (region.some((op) => op.type === "add")) {
      out.push({
        type: "add",
        text: region.filter((op) => op.type !== "remove").map((op) => op.text).join(""),
      });
    }
    i = end;
  }
  return out;
}

// Classic longest-common-subsequence diff. The table holds the LCS length of
// every (a[i:], b[j:]) pair; walking it forward from (0,0) and always stepping
// toward the larger remaining subsequence yields the minimal edit script.
function lcsDiff(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Int32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + (j + 1)] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + (j + 1)]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", text: a[i] });
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + (j + 1)]) {
      ops.push({ type: "remove", text: a[i] });
      i++;
    } else {
      ops.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: "remove", text: a[i++] });
  while (j < m) ops.push({ type: "add", text: b[j++] });
  return ops;
}

export type DiffStats = { added: number; removed: number };

export function diffStats(ops: DiffOp[]): DiffStats {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === "equal") continue;
    if (op.type === "add") added += countWords(op.text);
    else removed += countWords(op.text);
  }
  return { added, removed };
}

// Everything of one type, flattened to a single line and clipped. Used for the
// one-line gist on a history row, where the full text would be far too much.
export function diffExcerpt(ops: DiffOp[], type: "add" | "remove", max = 140): string {
  const text = ops
    .filter((op) => op.type === type)
    .map((op) => op.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

// Collapse long untouched stretches so the rendered diff shows the changes and
// just enough surrounding text to place them, rather than the whole document.
export function condenseDiff(ops: DiffOp[], context = 48): DiffOp[] {
  return ops.map((op, i) => {
    if (op.type !== "equal") return op;

    const isFirst = i === 0;
    const isLast = i === ops.length - 1;
    // A lone equal op means nothing changed; there's no context to trim around.
    if (isFirst && isLast) return op;

    if (isFirst) {
      const clipped = clipToTail(op.text, context);
      return clipped === op.text ? op : { ...op, text: `… ${clipped}` };
    }
    if (isLast) {
      const clipped = clipToHead(op.text, context);
      return clipped === op.text ? op : { ...op, text: `${clipped} …` };
    }
    if (op.text.length <= context * 2) return op;
    return {
      ...op,
      text: `${clipToHead(op.text, context)} … ${clipToTail(op.text, context)}`,
    };
  });
}

// Both clips stop at a word boundary. Cutting on a raw character count instead
// puts the ellipsis mid-word — "… ts earlier" reads as corrupted text rather
// than as elided context, which rather undermines a view whose whole job is to
// tell you exactly what changed.
function clipToHead(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const cut = lastSpace(head);
  return (cut > 0 ? head.slice(0, cut) : head).trimEnd();
}

function clipToTail(text: string, max: number): string {
  if (text.length <= max) return text;
  const tail = text.slice(-max);
  const cut = firstSpace(tail);
  return (cut >= 0 ? tail.slice(cut + 1) : tail).trimStart();
}

function lastSpace(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) if (/\s/.test(text[i])) return i;
  return -1;
}

function firstSpace(text: string): number {
  for (let i = 0; i < text.length; i++) if (/\s/.test(text[i])) return i;
  return -1;
}
