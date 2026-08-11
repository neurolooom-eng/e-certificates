"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { SafeUser } from "@/lib/users";

interface MemberRow {
  userId: string;
  role: "owner" | "member";
  name: string;
  username: string;
}

interface AcademyRow {
  id: string;
  name: string;
  createdAt: string;
  role: "owner" | "member";
  members?: MemberRow[];
}

export default function AcademiesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [academies, setAcademies] = useState<AcademyRow[]>([]);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [members, setMembers] = useState<Record<string, MemberRow[]>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [addDraft, setAddDraft] = useState<{ userId: string; username: string; role: string }>({
    userId: "", username: "", role: "member",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/academies");
    if (res.ok) {
      const data = await res.json();
      setAcademies(data.academies);
      setIsAdminUser(data.admin);
    } else {
      setError("Sign in to see your academies.");
    }
    // Only an admin can list accounts; owners pick from members they add by name.
    const uRes = await fetch("/api/users");
    if (uRes.ok) setUsers(await uRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadMembers(academyId: string) {
    const res = await fetch(`/api/academies/${academyId}/members`);
    if (!res.ok) return;
    const rows = await res.json();
    setMembers((m) => ({ ...m, [academyId]: rows }));
  }

  function toggle(academyId: string) {
    const next = open === academyId ? null : academyId;
    setOpen(next);
    if (next) loadMembers(next);
  }

  async function createAcademy(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/academies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, ownerIds: newOwner ? [newOwner] : [] }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setNewName("");
      setNewOwner("");
      await load();
    } else {
      setError(data.error || "Could not create the academy.");
    }
    setBusy(false);
  }

  async function addMember(academyId: string) {
    if (!addDraft.userId && !addDraft.username.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/academies/${academyId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addDraft),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Could not add that account.");
    setAddDraft({ userId: "", username: "", role: "member" });
    await loadMembers(academyId);
    await load();
    setBusy(false);
  }

  async function changeRole(academyId: string, userId: string, role: string) {
    setBusy(true);
    await fetch(`/api/academies/${academyId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    await loadMembers(academyId);
    setBusy(false);
  }

  async function removeMember(academyId: string, userId: string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/academies/${academyId}/members?userId=${userId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not remove that account.");
    }
    await loadMembers(academyId);
    setBusy(false);
  }

  async function removeAcademy(academyId: string, name: string) {
    if (!confirm(`Delete “${name}”? Its tournaments stay, but its owners stop seeing them.`)) return;
    setBusy(true);
    await fetch(`/api/academies/${academyId}`, { method: "DELETE" });
    await load();
    setBusy(false);
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-gray-500">Sign in to see your academies.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <a href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700">← All Tournaments</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Academies</h1>
        <p className="text-gray-500 text-sm mt-1">
          Owners see every tournament run under their academy. Members see only their own.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {isAdminUser && (
        <form onSubmit={createAcademy} className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h2 className="font-semibold text-gray-900 text-sm mb-3">Add an academy</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Academy name"
              className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Choose the owner…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg font-medium"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            The owner can add and remove their own members afterwards. You can add more owners later.
          </p>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {academies.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray-400 text-sm">
            {isAdminUser ? "No academies yet. Add one above." : "You don’t belong to an academy yet."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {academies.map((a) => (
              <li key={a.id}>
                <div className="px-6 py-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-medium text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      You are {a.role === "owner" ? "an owner" : "a member"}
                    </p>
                  </div>
                  {a.role === "owner" && (
                    <button
                      onClick={() => toggle(a.id)}
                      className="text-sm text-brand-600 hover:text-brand-700"
                    >
                      {open === a.id ? "Hide members" : "Manage members"}
                    </button>
                  )}
                  {isAdminUser && (
                    <button
                      onClick={() => removeAcademy(a.id, a.name)}
                      disabled={busy}
                      className="text-sm text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {open === a.id && (
                  <div className="px-6 pb-5 bg-gray-50 border-t border-gray-100">
                    <ul className="divide-y divide-gray-200 mb-3">
                      {(members[a.id] ?? []).map((m) => (
                        <li key={m.userId} className="py-2.5 flex flex-wrap items-center gap-3">
                          <span className="flex-1 min-w-[160px] text-sm text-gray-800">
                            {m.name} <span className="text-gray-400">@{m.username}</span>
                          </span>
                          <select
                            value={m.role}
                            onChange={(e) => changeRole(a.id, m.userId, e.target.value)}
                            disabled={busy}
                            className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white"
                          >
                            <option value="member">Member</option>
                            <option value="owner">Owner</option>
                          </select>
                          <button
                            onClick={() => removeMember(a.id, m.userId)}
                            disabled={busy}
                            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                      {(members[a.id] ?? []).length === 0 && (
                        <li className="py-3 text-sm text-gray-400">No members yet.</li>
                      )}
                    </ul>

                    <div className="flex flex-wrap gap-2 items-center pt-1">
                      {isAdminUser ? (
                        <select
                          value={addDraft.userId}
                          onChange={(e) => setAddDraft({ ...addDraft, userId: e.target.value })}
                          className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          <option value="">Add an account…</option>
                          {users
                            .filter((u) => !(members[a.id] ?? []).some((m) => m.userId === u.id))
                            .map((u) => (
                              <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                            ))}
                        </select>
                      ) : (
                        <input
                          value={addDraft.username}
                          onChange={(e) => setAddDraft({ ...addDraft, username: e.target.value })}
                          placeholder="Username to add"
                          className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      )}
                      <select
                        value={addDraft.role}
                        onChange={(e) => setAddDraft({ ...addDraft, role: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option value="member">Member</option>
                        <option value="owner">Owner</option>
                      </select>
                      <button
                        onClick={() => addMember(a.id)}
                        disabled={busy || (!addDraft.userId && !addDraft.username.trim())}
                        className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg font-medium"
                      >
                        Add
                      </button>
                    </div>
                    {!isAdminUser && (
                      <p className="text-xs text-gray-400 mt-2">
                        Add someone by their username. The account must exist already — ask an
                        administrator to create it if it doesn’t.
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
