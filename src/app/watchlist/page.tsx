import { WatchlistBoard } from "@/components/WatchlistBoard";
import { PersonalIntel } from "@/components/PersonalIntel";
import { getIntelBriefing } from "@/lib/intel/briefing";
import { Disclaimer, Hero, MoreLink, Page, Section } from "@/components/ui";

export const revalidate = 300;

export const metadata = {
  title: "מעקב",
  description:
    "רשימת המעקב שלך, ומה השתנה בה מאז הביקור הקודם — מחיר, דוח חדש, וכתבות שנוספו, עם הממצאים המהותיים שנוגעים דווקא לחברות שלך.",
};

/**
 * The watchlist.
 *
 * The list itself runs in the browser, so most of this page is a frame.
 * That is not a limitation to hide: a list stored on the reader's machine
 * needs no account and no database, which is what lets the feature exist
 * at all on a project that pays nothing a month.
 *
 * The intelligence section above it is the same briefing the `/intel` page
 * builds, filtered client-side against that local list. The server sends
 * every material finding and the browser keeps the few that match — which
 * is the only architecture available when the server has never been told
 * what the reader follows, and also the one a reader would choose.
 */
export default async function WatchlistPage() {
  const briefing = await getIntelBriefing();

  return (
    <Page tint="#0a84ff" width="wide">
      <Hero
        eyebrow="מעקב"
        title="מה השתנה בחברות שאתה עוקב אחריהן"
        lede="רשימת מעקב שנשמרת בדפדפן שלך. בכל כניסה היא משווה את המצב הנוכחי לזה שנשמר בפעם הקודמת, ומראה מה זז — מחיר, דוח חדש שנקלט, או כתבות שהתווספו לפיד."
      />

      {/* The findings first, the list after. A reader returning to this
          page has already seen the list; what they came back for is
          whether anything in it did something. */}
      <Section
        eyebrow="המודיעין שלך"
        title="מה מהממצאים של היום נוגע לך"
        description="הממצאים נבנים לכל האתר ומסוננים כאן מול הרשימה שלך. יום שבו אף חברה שלך לא הפיקה ממצא מהותי נאמר במפורש, ולא מולא בממצא הקרוב ביותר."
        action={<MoreLink href="/intel">כל המודיעין</MoreLink>}
      >
        <PersonalIntel signals={briefing.signals} risks={briefing.risks} />
      </Section>

      <Section
        eyebrow="הרשימה"
        title="החברות במעקב"
        description="הנתונים כאן מגיעים מקובץ המדדים שנבנה בלילה ומציטוט חי. הקריאה המלאה — מבחן הליבה, התזה והטכני — נמצאת בעמוד של כל חברה."
      >
        <WatchlistBoard />
      </Section>

      <Disclaimer extra="הרשימה נשמרת מקומית בדפדפן ואינה עוברת לשרת. ניקוי נתוני האתר בדפדפן ימחק אותה." />
    </Page>
  );
}
