import { readTournaments } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Public directory of tournaments. This is the front door participants land
 * on — it lists every tournament whose certificates are published, each
 * linking to its own public certificate page.
 */
export default async function Home() {
  const all = await readTournaments();
  const published = all
    .filter((t) => !t.archived && t.certificates.length > 0)
    .sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="text-center mb-10">
          <p className="text-4xl mb-3">🏆</p>
          <h1 className="text-3xl font-bold text-gray-900">E-Certificates</h1>
          <p className="text-gray-500 mt-2">
            Choose your tournament, then search for your name to download your certificate.
          </p>
        </header>

        {published.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <p className="font-medium">No certificates published yet.</p>
            <p className="text-sm mt-1">Check back after the next tournament.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {published.map((t) => (
              <a
                key={t.id}
                href={`/share/${t.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-brand-500 transition-all"
              >
                <h2 className="font-semibold text-gray-900 text-lg leading-tight">{t.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(t.eventDate).toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </p>
                <p className="text-sm font-medium text-brand-500 mt-3">
                  {t.certificates.length} certificate{t.certificates.length === 1 ? "" : "s"} →
                </p>
              </a>
            ))}
          </div>
        )}

        <p className="text-center mt-10">
          <a href="/tournaments" className="text-xs text-gray-400 hover:text-gray-600">
            Organiser login
          </a>
        </p>
      </div>
    </div>
  );
}
