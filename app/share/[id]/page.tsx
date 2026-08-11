import { getTournament } from "@/lib/storage";
import ShareTable from "./ShareTable";

export const dynamic = "force-dynamic";

/**
 * Public certificate page — no login required. This is the link organisers
 * hand out to participants, so it must stay outside the auth middleware.
 */
export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournament(id);

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Certificates not found</h1>
          <p className="text-gray-500 text-sm">This link may be incorrect or the tournament was removed.</p>
        </div>
      </div>
    );
  }

  const ready = tournament.status === "ready";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <header className="text-center mb-8">
          <p className="text-4xl mb-3">🏆</p>
          <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-gray-500 mt-1">
            {new Date(tournament.eventDate).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric",
            })}
          </p>
          <p className="text-sm text-gray-400 mt-3">
            Find your name below and click to open or download your certificate.
          </p>
        </header>

        {!ready && tournament.certificates.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <p className="font-medium">Certificates are still being prepared.</p>
            <p className="text-sm mt-1">Please check back shortly.</p>
          </div>
        ) : (
          <ShareTable certificates={tournament.certificates} />
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          {tournament.certificates.length} certificate
          {tournament.certificates.length === 1 ? "" : "s"} · Links are permanent
        </p>
      </div>
    </div>
  );
}
