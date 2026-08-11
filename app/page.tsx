import { Playfair_Display, JetBrains_Mono } from "next/font/google";
import { readTournaments } from "@/lib/storage";

export const dynamic = "force-dynamic";

const display = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" });

/**
 * Public directory of tournaments — the front door participants land on.
 * Each entry links to that tournament's own certificate page.
 */
export default async function Home() {
  const all = await readTournaments();
  const published = all
    .filter((t) => !t.archived && t.certificates.length > 0)
    .sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1));

  return (
    <div className={`${display.variable} ${mono.variable} cert-page min-h-screen`}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-14">
        <header>
          <p className="cert-eyebrow">E-Certificates · Find yours</p>
          <h1 className="cert-title text-5xl sm:text-6xl leading-[1.05] mt-4">Tournament Certificates</h1>
          <p className="cert-sub mt-4">
            Choose your tournament, then search for your name.
          </p>
        </header>

        <div className="cert-rule mt-8 mb-8" />

        {published.length === 0 ? (
          <p className="cert-sub text-center py-20">
            No certificates published yet. Check back after the next tournament.
          </p>
        ) : (
          <ul>
            {published.map((t) => (
              <li key={t.id} className="cert-row">
                <span className="cert-name">
                  <a href={`/share/${t.id}`} className="hover:underline">
                    {t.name}
                  </a>
                  <span className="cert-cat">
                    {new Date(t.eventDate).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </span>
                </span>
                <a href={`/share/${t.id}`} className="cert-open">
                  {t.certificates.length} <span aria-hidden>↗</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="text-center mt-12">
          <a href="/tournaments" className="cert-sub hover:underline text-xs">
            Organiser login
          </a>
        </p>
      </div>
    </div>
  );
}
