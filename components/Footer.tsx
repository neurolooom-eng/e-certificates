export function Footer() {
  const build = process.env.NEXT_PUBLIC_BUILD_NUMBER ?? "0";
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? "local";

  return (
    <footer className="mt-12 border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-xs text-gray-400">
        <span>E-Certificates Generator</span>
        <span className="font-mono">
          build <span className="text-gray-600 font-semibold">#{build}</span>
          <span className="mx-2 text-gray-300">·</span>
          <span>{env}</span>
        </span>
      </div>
    </footer>
  );
}
