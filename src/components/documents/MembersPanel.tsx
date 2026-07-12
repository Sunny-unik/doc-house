"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DocRole } from "@/db/schema";

type Member = {
  userId: string;
  email: string;
  name: string;
  role: DocRole;
};

type Message = { kind: "success" | "error"; text: string } | null;

export function MembersPanel({
  documentId,
  currentUserId,
  currentUserRole,
  initialMembers,
}: {
  documentId: string;
  currentUserId: string;
  currentUserRole: DocRole;
  initialMembers: Member[];
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isOwner = currentUserRole === "owner";

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    startTransition(async () => {
      const res = await fetch(`/api/documents/${documentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ kind: "error", text: data?.error ?? "Could not send invite." });
        return;
      }
      setMembers((prev) => [...prev, data.member as Member]);
      setInviteEmail("");
      setMessage({
        kind: "success",
        text: `${data.member.email} added as ${data.member.role}.`,
      });
    });
  }

  async function changeRole(userId: string, role: "editor" | "viewer") {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/documents/${documentId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMessage({ kind: "error", text: data?.error ?? "Could not change role." });
        return;
      }
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
    });
  }

  async function remove(userId: string) {
    const self = userId === currentUserId;
    const prompt = self
      ? "Leave this document? You'll need to be re-invited to regain access."
      : "Remove this person from the document?";
    if (!window.confirm(prompt)) return;

    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/documents/${documentId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMessage({ kind: "error", text: data?.error ?? "Could not remove." });
        return;
      }
      if (self) {
        router.push("/app");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    });
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold tracking-tight">People with access</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {isOwner
          ? "Invite people by email, change their role, or revoke access anytime."
          : "You have access to this document. You can leave at any time."}
      </p>

      {isOwner ? (
        <form onSubmit={invite} className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@example.com"
            aria-label="Invite by email"
            className="min-w-56 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:focus:border-zinc-500"
            disabled={pending}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
            aria-label="Invite role"
            className="rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
            disabled={pending}
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={pending || !inviteEmail.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "Inviting…" : "Invite"}
          </button>
        </form>
      ) : null}

      {message ? (
        <p
          role="status"
          className={
            message.kind === "success"
              ? "mt-3 text-sm text-emerald-600 dark:text-emerald-400"
              : "mt-3 text-sm text-red-600 dark:text-red-400"
          }
        >
          {message.text}
        </p>
      ) : null}

      <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
        {members.map((m) => {
          const self = m.userId === currentUserId;
          const canChangeRole = isOwner && !self && m.role !== "owner";
          const canRemove = m.role !== "owner" && (isOwner || self);
          return (
            <li key={m.userId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {m.name || m.email}
                  {self ? (
                    <span className="ml-2 text-xs font-normal text-zinc-500">(you)</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-zinc-500">{m.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canChangeRole ? (
                  <select
                    value={m.role}
                    onChange={(e) =>
                      changeRole(m.userId, e.target.value as "editor" | "viewer")
                    }
                    aria-label={`Change ${m.email}'s role`}
                    disabled={pending}
                    className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span className="text-xs uppercase tracking-wide text-zinc-500">
                    {m.role}
                  </span>
                )}
                {canRemove ? (
                  <button
                    type="button"
                    onClick={() => remove(m.userId)}
                    disabled={pending}
                    className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    {self ? "Leave" : "Remove"}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
