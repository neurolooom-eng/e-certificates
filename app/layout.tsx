import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "E-Certificates Generator",
  description: "Generate and distribute certificates for tournaments and events",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <NavBar />
          <Shell>{children}</Shell>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
