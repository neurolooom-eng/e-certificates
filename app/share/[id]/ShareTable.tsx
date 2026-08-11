"use client";

import { useMemo, useState } from "react";
import type { Certificate } from "@/lib/types";

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  return { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
}

export default function ShareTable({
  certificates,
  categories,
}: {
  certificates: Certificate[];
  categories: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return certificates.filter((c) => {
      if (category && c.category !== category) return false;
      if (!q) return true;
      return (
        c.recipientName.toLowerCase().includes(q) ||
        (c.category ?? "").toLowerCase().includes(q) ||
        (c.rank !== undefined && String(c.rank).startsWith(q))
      );
    });
  }, [certificates, query, category]);

  return (
    <div>
      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setCategory("")}
            className={`cert-chip ${category === "" ? "cert-chip-on" : ""}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`cert-chip ${category === c ? "cert-chip-on" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-5">
        <div className="cert-search flex-1 flex items-center gap-3">
          <svg className="w-4 h-4 shrink-0 opacity-40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Search by name or rank…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent outline-none"
          />
        </div>
        <p className="cert-count shrink-0">
          <strong>{filtered.length}</strong> shown
        </p>
      </div>

      {/* Rows */}
      <ul className="mt-6">
        {filtered.map((cert, i) => (
          <li key={`${cert.driveLink}-${i}`} className="cert-row">
            <span className="cert-rank">
              {cert.rank !== undefined ? (
                <>
                  {cert.rank}
                  <sup>{ordinalSuffix(cert.rank)}</sup>
                </>
              ) : (
                <span className="opacity-25">–</span>
              )}
            </span>

            <span className="cert-name">
              {cert.recipientName}
              {/* Only worth showing when it distinguishes rows — a single
                  category is already named in the page subtitle */}
              {cert.category && categories.length > 1 && !category && (
                <span className="cert-cat">{cert.category}</span>
              )}
            </span>

            <a href={cert.driveLink} target="_blank" rel="noreferrer" className="cert-open">
              Open <span aria-hidden>↗</span>
            </a>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="cert-sub text-center py-16">
          Nothing matches {query ? `“${query}”` : "that filter"}. Check the spelling, or ask the organiser.
        </p>
      )}
    </div>
  );
}
