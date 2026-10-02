import type { Metadata } from "next";
import { Assistant, Frank_Ruhl_Libre, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "./market.css";
import "./studio.css";
import "./financial.css";
import "./cinema.css";
import "./luminous.css";
import { RouteTransition } from "@/components/market/RouteTransition";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CommandCenter } from "@/components/CommandCenter";
import { MobileTabs } from "@/components/MobileTabs";
import { WelcomeGate } from "@/components/welcome/WelcomeGate";
import { ScrollReveal } from "@/components/ScrollReveal";

/**
 * The interface face.
 *
 * Assistant, not Heebo. Heebo is a Hebrew companion to Roboto, and
 * Roboto is the sound of an Android system dialog — correct, neutral,
 * and the reason the old pages read as software rather than as a
 * publication. Assistant is drawn with more open counters and a
 * humanist axis, which is what carries a 4rem headline in Hebrew
 * without it turning into a slab.
 */
const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-assistant",
  display: "swap",
});

/** Reserved: the wordmark's long form and editorial passages. */
const frank = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500"],
  variable: "--font-frank",
  display: "swap",
});

/** Every figure on the site. Tabular by construction. */
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
      className={`${assistant.variable} ${frank.variable} ${plexMono.variable}`}
    >
      <head>
        {/*
          Whether the door has already been opened, decided before the first
          paint.

          The gate renders by default and hides itself in an effect, which is
          right for a first visit — a door that waits for JavaScript shows
          the page it is meant to be covering. But it means a reader who
          already came through this session gets a full screen of warm
          mustard for the frame between paint and hydration, on every
          navigation. Measured: the door was fully painted in a screenshot
          taken after a reload whose sessionStorage flag was already set.

          A blocking script in <head> runs before the body is painted, so
          the class is on <html> in time for CSS to settle it either way.
          Wrapped in try/catch because private browsing throws on the read,
          and the correct answer when storage is unavailable is to show the
          door rather than to fail open.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(sessionStorage.getItem("market-intel:welcome:v1")==="1")document.documentElement.classList.add("entered")}catch(e){}',
          }}
        />
      </head>
      <body className="market-app min-h-screen bg-base text-ink">
        {/* The door, in front of everything. It removes itself for anyone
            who has already come through this session, and for anyone who
            asked not to be moved. */}
        <WelcomeGate />

        <a href="#main-content" className="skip-link">דלג לתוכן</a>
        {/* One fixed layer behind everything. It reads --tint, which each
            page sets, so the light behind the content belongs to the page
            without the layer knowing what is on it.

            The grain layer that used to sit here is gone: film grain over
            a large dark field stops it banding, and over white it only
            makes the page look dirty. */}
        <div className="backdrop" aria-hidden="true" />

        {/* Global, so ⌘K works from every page including a company page
            deep in a scroll. Renders nothing until it is opened. */}
        <CommandCenter />

        <ScrollReveal />
        <AppHeader />
        <RouteTransition>{children}</RouteTransition>
        <SiteFooter />

        {/* Clears the fixed bottom bar so the footer is not trapped
            under it on a phone. */}
        <div className="h-16 md:hidden" aria-hidden="true" />

        <MobileTabs />
      </body>
    </html>
  );
}
