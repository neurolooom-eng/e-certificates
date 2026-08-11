"use client";

import { useState } from "react";

export default function SignupPage() {
  const [form, setForm] = useState({
    name: "", organisation: "", email: "", username: "", password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error || "Sign-up failed.");
      else setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSubmitting(false);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-4xl mb-3">📬</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Request sent</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your account is waiting for approval. Once an administrator approves it you can sign in
            with the username <strong className="text-gray-700">{form.username}</strong> and create
            your own tournaments.
          </p>
          <a href="/login" className="text-sm text-brand-500 hover:text-brand-600 font-medium">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <p className="text-3xl mb-2">🏆</p>
          <h1 className="text-xl font-bold text-gray-900">Request an organiser account</h1>
          <p className="text-sm text-gray-500 mt-1">
            An administrator approves new accounts before they can be used.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your name *</label>
            <input
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Club / organisation</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={form.organisation}
              onChange={(e) => set("organisation", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
            <input
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="lowercase, no spaces"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <input
              required
              type="password"
              minLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>

          {error && (
            <p className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            {submitting ? "Sending…" : "Request account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{" "}
          <a href="/login" className="text-brand-500 hover:text-brand-600 font-medium">Sign in</a>
        </p>
      </div>
    </div>
  );
}
