"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { SafeUser } from "@/lib/users";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-gray-100 text-gray-500",
};

export default function UsersPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
    else setError("You need to be an administrator to manage accounts.");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function update(id: string, status: "approved" | "rejected" | "pending") {
    setBusy(id);
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setBusy(null);
  }

  async function remove(id: string) {
    setBusy(id);
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    await load();
    setBusy(null);
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (session?.user?.role !== "admin") {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-gray-500">{error || "Administrators only."}</p>
      </div>
    );
  }

  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <a href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700">← All Tournaments</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Accounts</h1>
        <p className="text-gray-500 text-sm mt-1">
          Approve organisers so they can create and generate their own tournaments.
        </p>
      </div>

      {pending.length > 0 && (
        <div className="bg-white rounded-xl border border-yellow-200 overflow-hidden mb-6">
          <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-200">
            <h2 className="font-semibold text-yellow-900 text-sm">
              Awaiting approval ({pending.length})
            </h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {pending.map((u) => (
              <li key={u.id} className="px-6 py-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium text-gray-900">
                    {u.name} <span className="text-gray-400 font-normal">@{u.username}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[u.organisation, u.email].filter(Boolean).join(" · ") || "No details given"}
                  </p>
                </div>
                <button
                  onClick={() => update(u.id, "approved")}
                  disabled={busy === u.id}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg font-medium"
                >
                  Approve
                </button>
                <button
                  onClick={() => update(u.id, "rejected")}
                  disabled={busy === u.id}
                  className="border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-600 text-sm px-4 py-2 rounded-lg"
                >
                  Reject
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">All accounts</h2>
        </div>
        {others.length === 0 && pending.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray-400 text-sm">
            No accounts yet. Share the sign-up link and approvals will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {others.map((u) => (
              <li key={u.id} className="px-6 py-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium text-gray-900">
                    {u.name} <span className="text-gray-400 font-normal">@{u.username}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[u.organisation, u.email].filter(Boolean).join(" · ") || "No details given"}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[u.status]}`}>
                  {u.status}
                </span>
                {u.status === "approved" ? (
                  <button
                    onClick={() => update(u.id, "rejected")}
                    disabled={busy === u.id}
                    className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    onClick={() => update(u.id, "approved")}
                    disabled={busy === u.id}
                    className="text-sm text-green-600 hover:text-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => remove(u.id)}
                  disabled={busy === u.id}
                  className="text-sm text-red-400 hover:text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
