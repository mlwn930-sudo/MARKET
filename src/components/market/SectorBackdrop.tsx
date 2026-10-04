import Image from "next/image";
import { HeroParallax } from "@/components/HeroParallax";
import type { SectorKey } from "@/lib/universe";

/**
 * The photograph behind a company masthead.
 *
 * The masthead is the one dark band on this site that never had art in it,
 * and it is the band a reader meets most often: it is where you land from
 * a table, a search result or a watchlist row. The change of material is
 * what tells somebody they have arrived somewhere rather than filtered
 * something, and until now that change was carried by a gradient alone.
 *
 * ONE FRAME PER SECTOR, NOT PER COMPANY. A hundred and twenty-three
 * companies share nine photographs, so each one has to be a PLACE and not
 * a business: a fab bay, a banking hall, a container quay. Nothing in the
 * frame may belong to one company, because the next fourteen tickers filed
 * under that sector get the same picture. That rules out logos, products
 * and anything recognisable — which is a constraint on the art, and also
 * the reason this can exist at all on a project that pays nothing.
 *
 * A company outside the research universe has no sector and gets no
 * photograph. The masthead already reads without one; inventing a frame
 * for an unknown ticker would be decorating a gap.
 */

/** The nine, by sector key. Every file is 21:9 at 2400px wide and graded
 *  bright, because the band sinks it to a fifth of its own weight. */
const FRAME: Record<SectorKey, string> = {
  semis: "/sector/semis.webp",
  software: "/sector/software.webp",
  internet: "/sector/internet.webp",
  healthcare: "/sector/healthcare.webp",
  financials: "/sector/financials.webp",
  energy: "/sector/energy.webp",
  consumer: "/sector/consumer.webp",
  industrials: "/sector/industrials.webp",
  telecom: "/sector/telecom.webp",
};

/** What each frame actually shows, for a reader who cannot see it. Said
 *  as the place it is, not as the sector it stands for — the sector is
 *  already in the breadcrumb two lines above. */
const ALT: Record<SectorKey, string> = {
  semis: "מסדרון בין מכונות ליתוגרפיה בחדר נקי",
  software: "קומת משרדים מזוגגת בלילה",
  internet: "שורת צלחות לוויין בשעת דמדומים",
  healthcare: "אולם ייצור פארמה עם מיכלי נירוסטה",
  financials: "אולם בורסה עם קולונדה וגג זכוכית",
  energy: "בית זיקוק בלילה מעבר למים",
  consumer: "מעבר במרכז לוגיסטי",
  industrials: "מסוף מכולות בלילה עם מנופי שער",
  telecom: "שורת תרני שידור על רכס בדמדומים",
};

export function SectorBackdrop({ sector }: { sector: SectorKey | null }) {
  if (!sector) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <HeroParallax>
        <Image
          src={FRAME[sector]}
          alt={ALT[sector]}
          fill
          /* Not `priority`. On this page the figures are what the reader
             came for, and the masthead photograph competing with them for
             the first bytes would be the art direction winning an argument
             it should not be in. */
          sizes="100vw"
          className="object-cover object-center opacity-[0.42]"
        />
      </HeroParallax>

      {/* Two washes, as on `Hero`, and weighted DOWN the band rather than
          evenly across it.
          The numbers decided these, not taste. The first attempt ran 0.74
          to 0.97 over a photograph at 0.22, and measuring the stack
          explained why nothing was visible: the band's own ground sits at
          luma 31, the photograph was contributing seven levels on top of
          it, and seven levels is not a picture. At 0.42 under a 0.18 wash
          the same frame lands near 54 — present, clearly subordinate, and
          still a tenth of the brightness of the type set over it.
          The figures all sit in the lower half — price, change, market
          cap, the metric row — so that is where the wash stays heavy. The
          top carries a breadcrumb and the company name in large bright
          type, which needs far less cover, and that is where the picture
          is allowed to show. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(8,15,27,0.18)_0%,rgba(8,15,27,0.68)_52%,rgba(8,15,27,0.94)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_left,transparent_34%,rgba(8,15,27,0.66)_100%)]" />
    </div>
  );
}
