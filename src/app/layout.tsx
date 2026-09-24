import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  // 800 is the display weight. Without it the browser synthesises a bold,
  // which on Hebrew smears the counters at large sizes.
  weight: ["400", "500", "700", "800"],
  variable: "--font-heebo",
  display: "swap",
});

const frank = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500"],
  variable: "--font-frank",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Market Intel — מודיעין שוק ההון",
    template: "%s · Market Intel",
  },
  description:
    "פלטפורמת מחקר לשוק ההון האמריקאי: ניתוח פונדמנטלי מול חציון הסקטור, קריאה טכנית, מעקב מוסדי וחדשות מנותחות.",
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
      <body className="min-h-screen bg-base text-ink">
        {/* Two fixed layers behind everything. They read --tint, which each
            page sets, so the light behind the content belongs to the page
            without either layer knowing what is on it. */}
        <div className="backdrop" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />

        <SiteNav />
        <div className="min-h-[60vh]">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
