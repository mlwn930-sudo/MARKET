import { siteUrl } from "@/lib/site";
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
import { OpeningFilm } from "@/components/market/OpeningFilm";
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

const TITLE = "Market Intel — מודיעין שוק ההון";
const DESCRIPTION =
  "פלטפורמת מחקר לשוק ההון האמריקאי: ניתוח פונדמנטלי מול חציון הסקטור, קריאה טכנית, מעקב מוסדי וחדשות מנותחות.";

/**
 * What a link to this site looks like somewhere else.
 *
 * The site had a title and a description and nothing beyond them, which
 * meant a link pasted into WhatsApp, Telegram or Slack arrived as a bare
 * URL: no name, no sentence, no picture. For a research site that is not a
 * cosmetic loss. The entire use of the thing is to find something worth
 * showing another person and send it to them, and the moment it is sent it
 * stopped looking like a finding and started looking like a stray address.
 *
 * `metadataBase` is what makes the rest work: Open Graph consumers drop a
 * relative image outright, and without a base every card here would have
 * had one. It is resolved from the environment rather than hard-coded —
 * see lib/site.ts for the order and why the production host beats the
 * per-deployment one.
 *
 * The card image itself is generated, not drawn. `opengraph-image.tsx`
 * beside this file renders it at build time, and the company route has its
 * own carrying that company's name and colour. No design tool, no asset to
 * keep in sync with the palette, and nothing to pay for.
 *
 * `robots` says yes deliberately. This is not a commercial product — the
 * Finnhub licence sees to that — but it is also not private, and a
 * research page that cannot be found is a research page nobody reads.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: TITLE, template: "%s · Market Intel" },
  description: DESCRIPTION,
  applicationName: "Market Intel",
  openGraph: {
    type: "website",
    siteName: "Market Intel",
    locale: "he_IL",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${assistant.variable} ${frank.variable} ${plexMono.variable}`}
      /* The script below adds `entered` to this element before React
         hydrates, which is the whole point of it running there — so the
         server HTML and the client DOM genuinely differ on this one
         attribute, by design. Without this React reports a hydration
         mismatch on every page load and refuses to patch it, which is
         noise that hides real mismatches. It suppresses the warning for
         this element's own attributes only, not for its subtree. */
      suppressHydrationWarning
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
      <body className="market-app min-h-screen bg-ground text-ink">
        {/* In front of the door, which is in front of everything else.
            Thirty seconds that play themselves once a session and then
            get out of the way. It is here rather than on the home page
            because a film between a returning reader and the figures they
            came back for stops being an entrance and becomes a toll. */}
        <OpeningFilm />

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
