/**
 * The Tel Aviv universe, as plain data.
 *
 * Split from sources/tase.ts because that file imports unstable_cache and
 * is therefore server-only — and the command palette, which runs in the
 * browser, needs the same list to search. A client component importing the
 * source module pulls the Next cache into the browser bundle and fails the
 * build.
 */

export const TASE_INDICES: { symbol: string; name: string; note: string }[] = [
  {
    symbol: "TA35.TA",
    name: "ת״א 35",
    note: "35 החברות הגדולות בבורסה. מדד הדגל, ומשקלו מרוכז מאוד בבנקים ובביטחוניות.",
  },
  {
    symbol: "^TA125.TA",
    name: "ת״א 125",
    note: "125 החברות הגדולות. רחב יותר, ולכן מתאר את השוק המקומי טוב יותר מהמדד הצר.",
  },
];

/** The curated list. Hebrew names by hand, because Yahoo returns them
 *  truncated and in English ("BK LEUMI LE ISRAEL"). Sector labels use the
 *  same vocabulary as the US universe so the two sides of the site read
 *  the same way. */
export const TASE_LEADERS: {
  symbol: string;
  name: string;
  sector: string;
}[] = [
  { symbol: "LUMI.TA", name: "בנק לאומי", sector: "פיננסים" },
  { symbol: "POLI.TA", name: "בנק הפועלים", sector: "פיננסים" },
  { symbol: "MZTF.TA", name: "מזרחי טפחות", sector: "פיננסים" },
  { symbol: "DSCT.TA", name: "בנק דיסקונט", sector: "פיננסים" },
  { symbol: "PHOE.TA", name: "הפניקס", sector: "פיננסים" },

  { symbol: "ESLT.TA", name: "אלביט מערכות", sector: "ביטחוניות" },

  { symbol: "NICE.TA", name: "נייס", sector: "טכנולוגיה" },
  { symbol: "NVMI.TA", name: "נובה", sector: "טכנולוגיה" },
  { symbol: "CAMT.TA", name: "קמטק", sector: "טכנולוגיה" },
  { symbol: "TSEM.TA", name: "טאואר", sector: "טכנולוגיה" },

  { symbol: "TEVA.TA", name: "טבע", sector: "בריאות" },
  { symbol: "ICL.TA", name: "כיל", sector: "חומרים" },
  { symbol: "ORA.TA", name: "אורמת", sector: "אנרגיה" },
  { symbol: "ELAL.TA", name: "אל על", sector: "תעופה" },
];
