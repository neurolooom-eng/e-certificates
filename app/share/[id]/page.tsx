import { Playfair_Display, JetBrains_Mono } from "next/font/google";
import { getTournament } from "@/lib/storage";
import ShareTable from "./ShareTable";

export const dynamic = "force-dynamic";

const display = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" });

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTournament(id);
  return {
    title: t ? `${t.name} — Certificates` : "Certificates",
    description: t ? `Find and download your certificate for ${t.name}.` : undefined,
  };
}

/**
 * Public certificate page — no login required. This is the link organisers
 * hand out to participants, so it must stay outside the auth middleware.
 */
export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournament(id);

  if (!tournament) {
    return (
      <div className={`${display.variable} ${mono.variable} cert-page min-h-screen flex items-center justify-center px-6`}>
        <div className="text-center">
          <p className="cert-eyebrow mb-3">Certificate · Not found</p>
          <h1 className="cert-title text-4xl mb-2">This link doesn&apos;t work</h1>
          <p className="cert-sub">The address may be mistyped, or the tournament was removed.</p>
        </div>
      </div>
    );
  }

  const categories = Array.from(
    new Set(tournament.certificates.map((c) => c.category).filter(Boolean) as string[])
  );
  const year = new Date(tournament.eventDate).getFullYear();
  const subtitle = [
    categories.length === 1 ? categories[0] : null,
    String(year),
    "Certificate of Merit",
  ].filter(Boolean).join("  ·  ");

  return (
    <div className={`${display.variable} ${mono.variable} cert-page min-h-screen`}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-14">
        <header>
          <p className="cert-eyebrow">Certificate of Merit · Find yours</p>
          <h1 className="cert-title text-5xl sm:text-6xl leading-[1.05] mt-4">{tournament.name}</h1>
          <p className="cert-sub mt-4">{subtitle}</p>
        </header>

        <div className="cert-rule mt-8 mb-8" />

        {tournament.certificates.length === 0 ? (
          <div className="py-20 text-center">
            <p className="cert-sub">Certificates are still being prepared. Please check back shortly.</p>
          </div>
        ) : (
          <ShareTable certificates={tournament.certificates} categories={categories} />
        )}
      </div>
    </div>
  );
}
