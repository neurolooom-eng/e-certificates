"use client";

import { useState } from "react";
import type { Certificate } from "@/lib/types";

export default function ShareTable({ certificates }: { certificates: Certificate[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? certificates.filter(
        (c) =>
          c.recipientName.toLowerCase().includes(q) ||
          (c.category ?? "").toLowerCase().includes(q)
      )
    : certificates;

  const hasCategories = certificates.some((c) => c.category);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
        <input
          type="search"
          placeholder="Search for your name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          autoFocus
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="text-left px-4 sm:px-6 py-3">Name</th>
              {hasCategories && <th className="text-left px-4 py-3">Category</th>}
              <th className="text-right px-4 sm:px-6 py-3">Certificate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((cert, i) => (
              <tr key={`${cert.driveLink}-${i}`} className="hover:bg-gray-50">
                <td className="px-4 sm:px-6 py-3 font-medium text-gray-900">{cert.recipientName}</td>
                {hasCategories && (
                  <td className="px-4 py-3 text-gray-500">{cert.category ?? "—"}</td>
                )}
                <td className="px-4 sm:px-6 py-3 text-right whitespace-nowrap">
                  <a
                    href={cert.driveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View
                  </a>
                  <a
                    href={cert.driveLink}
                    download
                    className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 ml-4"
                  >
                    Download
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {q && filtered.length === 0 && (
        <p className="text-center text-gray-400 py-10 text-sm">
          No certificate found for &quot;{query}&quot;. Check the spelling, or contact the organiser.
        </p>
      )}
    </div>
  );
}
