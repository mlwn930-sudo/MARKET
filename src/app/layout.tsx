import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500"],
  variable: "--font-heebo",
});

const frank = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500"],
  variable: "--font-frank",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Market Intel — שוק ההון האמריקאי",
  description:
    "מחקר וניתוח פונדמנטלי של חברות אמריקאיות, מעקב מוסדי וחדשות גאופוליטיות.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${frank.variable} ${plexMono.variable}`}
    >
      <body className="min-h-screen bg-canvas text-ink">
        <SiteNav />
        {children}
        <footer className="mt-16 border-t border-line px-6 py-6 text-xs leading-relaxed text-ink-faint">
          האתר מציג נתונים וניתוחים לצורכי מחקר בלבד ואינו מהווה ייעוץ
          השקעות, שיווק השקעות או תחליף לייעוץ מקצועי המתחשב בנתוניו של כל
          אדם. נתוני SEC מבוססים על דוחות שהוגשו ועשויים לשקף מצב שאינו
          עדכני.
        </footer>
      </body>
    </html>
  );
}
