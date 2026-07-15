"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { DocRole } from "@/db/schema";

type Member = {
  userId: string;
  email: string;
  name: string;
  isGuest: boolean;
  role: DocRole;
};

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
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();

  const isOwner = currentUserRole === "owner";

  async function invite(event: React.FormEvent) {
    event.preventDefault();
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
        toast(data?.error ?? "Could not give access.", "error");
        return;
      }
      setMembers((prev) => [...prev, data.member as Member]);
      setInviteEmail("");
      toast(`${data.member.email} added as ${data.member.role}.`, "success");
    });
  }

  async function changeRole(userId: string, role: "editor" | "viewer") {
    startTransition(async () => {
      const res = await fetch(`/api/documents/${documentId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast(data?.error ?? "Could not change role.", "error");
        return;
      }
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
      toast(`Role updated to ${role}.`, "success");
    });
  }

  async function remove(userId: string) {
    const self = userId === currentUserId;
    const ok = await confirm(
      self
        ? {
            title: "Leave this document?",
            body: "You'll lose access immediately and need to be re-invited to get it back.",
            confirmLabel: "Leave",
            tone: "danger",
          }
        : {
            title: "Remove this person?",
            body: "They'll lose access immediately. Any edits they've already synced stay in the document.",
            confirmLabel: "Remove",
            tone: "danger",
          },
    );
    if (!ok) return;

    startTransition(async () => {
      const res = await fetch(`/api/documents/${documentId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast(data?.error ?? "Could not remove.", "error");
        return;
      }
      if (self) {
        router.push("/app");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast("Access removed.", "success");
    });
  }

  return (
    <div>
      <p className="text-sm text-text-muted">
        {isOwner
          ? "Give people access by email, change their role, or revoke it anytime."
          : "You have access to this document. You can leave at any time."}
      </p>

      {isOwner ? (
        <form onSubmit={invite} className="mt-4 flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <label htmlFor="invite-email" className="sr-only">
              Give access by email
            </label>
            <Input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              disabled={pending}
            />
          </div>
          <label htmlFor="invite-role" className="sr-only">
            Role for the new member
          </label>
          <Select
            id="invite-role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
            disabled={pending}
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </Select>
          <Button type="submit" disabled={pending || !inviteEmail.trim()}>
            {pending ? "Assigning…" : "Assign access"}
          </Button>
        </form>
      ) : null}

      {members.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No one else has access yet" />
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line">
          {members.map((m) => {
            const self = m.userId === currentUserId;
            const canChangeRole = isOwner && !self && m.role !== "owner";
            const canRemove = m.role !== "owner" && (isOwner || self);
            return (
              <li key={m.userId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">
                    {m.name || m.email}
                    {self ? (
                      <span className="ml-2 text-xs font-normal text-text-subtle">(you)</span>
                    ) : null}
                  </p>
                  {/* A guest's address is synthetic and unroutable — showing it
                      would be noise pretending to be contact information. */}
                  <p className="truncate text-xs text-text-subtle">
                    {m.isGuest ? "Joined with a share link" : m.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canChangeRole ? (
                    <>
                      <label htmlFor={`role-${m.userId}`} className="sr-only">
                        {/* Name, not email — a guest's address is a synthetic
                            uuid string, and reading that aloud helps nobody. */}
                        Change {m.name || m.email}&rsquo;s role
                      </label>
                      <Select
                        id={`role-${m.userId}`}
                        size="sm"
                        value={m.role}
                        onChange={(e) => changeRole(m.userId, e.target.value as "editor" | "viewer")}
                        disabled={pending}
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </Select>
                    </>
                  ) : (
                    <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Badge>
                  )}
                  {canRemove ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => remove(m.userId)}
                      disabled={pending}
                    >
                      {self ? "Leave" : "Remove"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
