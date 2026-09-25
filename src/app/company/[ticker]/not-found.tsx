import { Disclaimer, Empty, Hero, Page } from "@/components/ui";

/**
 * A symbol the site could not resolve.
 *
 * Reached when SEC has no filer behind the ticker, which in practice means
 * one of three things — a typo, a company that files outside the United
 * States, or one that has been delisted or renamed. The page says which
 * three rather than "not found", because the reader can act on a cause and
 * cannot act on a status code.
 */
export default function CompanyNotFound() {
  return (
    <Page width="read">
      <Hero
        eyebrow="חברה"
        title="הסימבול הזה לא נמצא"
        lede="עמוד חברה נבנה מדוחות שהוגשו ל-SEC. סימבול שאין מאחוריו מגיש רשום לא ייפתח כאן, גם אם הוא נסחר."
      />

      <div className="gap-section-tight">
        <Empty
          title="שלוש סיבות אפשריות"
          reason="שגיאת הקלדה בסימבול; חברה שאינה מגישה ל-SEC — כלומר נסחרת מחוץ לארצות הברית, ובכלל זה בתל אביב; או חברה שנמחקה מהמסחר, נרכשה, או שינתה סימבול."
          links={[
            { href: "/", label: "לשוק" },
            { href: "/israel", label: "מניות בתל אביב" },
            { href: "/opportunities", label: "כל החברות ביקום ההשוואה" },
            { href: "/heatmap", label: "מפת השוק" },
          ]}
        />
      </div>

      <Disclaimer />
    </Page>
  );
}
