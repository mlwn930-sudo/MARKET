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
        {/* Two fixed layers behind everything: accent-coloured light and a
            film of grain. They read --accent, which each page sets through
            <AccentTheme />, so the background changes with the page without
            either of them knowing what is on it. */}
        <div className="ambient" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />

        <SiteNav />
        {children}

        <footer className="mt-20 border-t border-line px-6 py-8">
          <div className="mx-auto max-w-6xl text-xs leading-relaxed text-ink-faint">
            <p>
              האתר מציג נתונים וניתוחים לצורכי מחקר בלבד ואינו מהווה ייעוץ
              השקעות, שיווק השקעות או תחליף לייעוץ מקצועי המתחשב בנתוניו של כל
              אדם. נתוני SEC מבוססים על דוחות שהוגשו ועשויים לשקף מצב שאינו
              עדכני.
            </p>
            <p className="mt-3">
              המסגרות האנליטיות באתר מתארות את מה שכבר קרה בדוחות ובמחיר. הן
              אינן תחזית, ואינן מתחשבות בתיק, באופק ההשקעה או במצב המס של
              הקורא. המערכת אינה מחוברת לברוקר ואינה מבצעת פעולות קנייה או
              מכירה.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
