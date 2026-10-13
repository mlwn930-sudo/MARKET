import { HORIZONS, MIN_SAMPLE } from "@/lib/metrics/base-rates";
import { isPrivateBuild } from "@/lib/private-mode";
import { buildTradePlan } from "@/lib/analysis/trade-plan";
import type { PositionRead } from "@/lib/analysis/position";
import type { WatchlistContext } from "@/lib/analysis/watchlist-context";
import {
  buildChartStance,
  directionLabel,
  ROUTE_KIND_NAME,
  HORIZON_NAME,
  HORIZON_SPAN,
} from "./stance";
import type { HorizonStance } from "./stance";
import type { ConditionRead, Horizon, Outcome } from "@/lib/metrics/base-rates";

/** What a horizon is called in a sentence a person reads. */
const HORIZON_LABEL: Record<Horizon, string> = {
  5: "שבוע",
  10: "שבועיים",
  21: "חודש",
  63: "רבעון",
};
import { CHARACTER_LABELS } from "@/lib/metrics/tape";
import type { Corroboration } from "./chart-corroborate";

/**
 * Everything the site measured about one chart, as text a model can read.
 *
 * The question-and-answer attached to a chart read lives or dies on this
 * function. A model asked "where is the entry" with no block in front of
 * it will produce a price, confidently, because that is what the question
 * invites — and the figure will be invented. Given a block, the same model
 * is a reader of measurements, and the rules in `CHART_ASK_SYSTEM` have
 * something to be enforced against.
 *
 * SO THE BLOCK IS ASSEMBLED IN CODE AND NOTHING IS ADDED TO IT. Every
 * line below comes from a panel already on the page: the levels checked
 * against real candles, the observations that converged, the volume read,
 * and the base rates counted over ten years. If a figure is not here, the
 * honest answer to a question about it is that it was not measured — and
 * the prompt says so in those words.
 *
 * It is also deliberately the SAME evidence the reader can see. An answer
 * citing something the page does not show would be unverifiable by the
 * person reading it, which is the failure mode this whole project is
 * arranged against.
 */
export function chartEvidence(
  checked: Corroboration,
  /** The reader's own followed names, when the page supplied them.
   *  Optional because the page that renders the evidence has no list
   *  and the question box does — and a missing list must mean "not
   *  asked" rather than "follows nothing". */
  watchlist?: WatchlistContext | null,
  /** The reader's own cost basis, when the page has been told it. */
  position?: PositionRead | null,
): string {
  const lines: string[] = [];

  lines.push(`נייר: ${checked.ticker}`);
  lines.push(`מחיר אחרון: ${checked.lastClose.toFixed(2)}`);
  lines.push(`נמדד על ${checked.candleCount} נרות יומיים.`);
  lines.push(...trendLines(checked));

  /* ---- Levels, with the test attached ---- */
  const confirmed = checked.levels.filter((l) => l.matched !== null);
  if (confirmed.length) {
    lines.push("\nרמות שהמחיר באמת התהפך בהן (אומתו מול הנרות):");
    for (const level of confirmed) {
      lines.push(
        `- ${level.matched!.toFixed(2)} · ${level.touches ?? "—"} תפניות נפרדות · ` +
          `הקריאה מהתמונה הייתה ${level.read.toFixed(2)}`,
      );
    }
  }
  const unconfirmed = checked.levels.filter((l) => l.matched === null);
  if (unconfirmed.length) {
    lines.push(
      `\n${unconfirmed.length} רמות שנקראו מהתמונה לא נמצאו בנרות. זה לא אומר שהן שגויות — ייתכן שהצילום הוא טווח זמן אחר.`,
    );
  }
  if (checked.missedByRead.length) {
    lines.push("\nרמות שהנרות מראים והקריאה לא הזכירה:");
    for (const band of checked.missedByRead) {
      lines.push(`- ${band.price.toFixed(2)} · ${band.touches} תפניות · ${band.kind}`);
    }
  }

  /* ---- What converged ---- */
  const setup = checked.setup;
  if (setup && (setup.observations.length || setup.tension.length)) {
    lines.push(
      `\n${setup.convergence} משפחות נמדדות נכונות בו-זמנית (${setup.families.join(", ")}), נכון ל-${setup.asOf}.`,
    );
    lines.push(
      "חשוב: מספר המשפחות נמדד ואינו מנבא דבר — על 17,566 תצפיות, התכנסות של שלוש ומעלה לוותה בעלייה ב-57.6% מול 57.9% ליום אקראי.",
    );
    for (const o of setup.observations) {
      lines.push(`- ${o.label} (${o.detail})`);
    }
    if (setup.tension.length) {
      lines.push("\nמה שמושך לכיוון השני:");
      for (const o of setup.tension) lines.push(`- ${o.label} (${o.detail})`);
    }
  }

  /* ---- The tape ---- */
  const bar = checked.tape?.latest;
  if (bar) {
    lines.push(
      `\nהנר האחרון שנסגר (${bar.date}): ${CHARACTER_LABELS[bar.character]}. ` +
        `מחזור ×${bar.volumeRatio.toFixed(1)}` +
        (bar.volumePercentile !== null
          ? ` (אחוזון ${Math.round(bar.volumePercentile * 100)} בשנה האחרונה)`
          : "") +
        `, טווח ${bar.rangePercent.toFixed(1)}%, סגירה ב-${Math.round(bar.closePosition * 100)}% מהטווח.`,
    );
  }
  if (checked.tape?.trend != null) {
    lines.push(
      `מחזור 10 ימים מול 50 שלפניהם: ×${checked.tape.trend.toFixed(2)}.`,
    );
  }
  /* THE SESSIONS THAT WERE NOT ORDINARY, which is what reading volume
     actually means. The block carried today's bar and the ten-day
     average and nothing in between, so an answer about volume could say
     how heavy today was and not whether the heavy days of the last month
     closed at their highs or their lows — which is the whole reading.
     Only non-quiet bars are in `notable`, so this is a short list by
     construction rather than every session reprinted. */
  const notable = checked.tape?.notable ?? [];
  if (notable.length) {
    lines.push(
      `\nימים חריגים מתוך ${checked.tape!.notableWindow} המסחר האחרונים ` +
        "(רק מה שלא היה רגיל; הסגירה היא המקום בתוך טווח הנר עצמו):",
    );
    for (const b of notable.slice(0, 5)) {
      lines.push(
        `- ${b.date}: ${CHARACTER_LABELS[b.character]} · מחזור ×${b.volumeRatio.toFixed(1)}` +
          (b.volumePercentile !== null
            ? ` (אחוזון ${Math.round(b.volumePercentile * 100)})`
            : "") +
          ` · סגירה ב-${Math.round(b.closePosition * 100)}% מהטווח · ` +
          `${b.changePercent >= 0 ? "+" : ""}${b.changePercent.toFixed(1)}%`,
      );
    }
  }
  /* The one volume reading that is about the series rather than a bar.
     It is also the only place the block says price and volume disagree,
     and a disagreement is worth more than either side alone. */
  const obv = checked.tape?.obv;
  if (obv) {
    lines.push(
      obv.divergence === "bearish"
        ? `מחזור מצטבר (OBV) על ${obv.window} ימי מסחר: המחיר עשה שיא גבוה יותר והמחזור המצטבר לא. זו סתירה נמדדת, לא התרשמות.`
        : obv.divergence === "bullish"
          ? `מחזור מצטבר (OBV) על ${obv.window} ימי מסחר: המחיר עשה שפל נמוך יותר והמחזור המצטבר לא. זו סתירה נמדדת, לא התרשמות.`
          : `מחזור מצטבר (OBV) על ${obv.window} ימי מסחר: נע עם המחיר, בלי סתירה. זה המצב הרגיל ונאמר כדי שלא ייראה כאילו לא נבדק.`,
    );
  }
  const profile = checked.tape?.profile;
  if (profile) {
    lines.push(
      `הכי הרבה מחזור נסחר סביב ${profile.poc.toFixed(2)}; אזור הערך ${profile.valueAreaLow.toFixed(2)}–${profile.valueAreaHigh.toFixed(2)}; ` +
        `המחיר ${profile.position === "above-value" ? "מעליו" : profile.position === "below-value" ? "מתחתיו" : "בתוכו"}. ` +
        `הפרופיל נבנה מנרות יומיים ולכן ה-POC הוא מרכז כובד ולא מחיר מדויק.`,
    );
  }

  /* ---- The counted history, which is what an answer should lean on ---- */
  const rates = checked.baseRates;
  if (rates) {
    const horizon = 21;
    const usable = rates.conditions
      .map((c) => ({ c, o: c.outcomes.find((x) => x.days === horizon) }))
      .filter((r) => r.o && r.o.n >= MIN_SAMPLE);

    const active = usable.filter((r) => r.c.activeNow);
    const waitable = usable.filter((r) => !r.c.activeNow);

    lines.push(
      `\nשיעורי בסיס, נספרו מ-${rates.sessions} ימי מסחר (${rates.from} עד ${rates.to}), אופק חודש:`,
    );
    /* EACH LINE CARRIES ITS OWN STATUS, not only the header above it.

       With the status in the header alone, the first real answer this
       route produced listed a death cross as something the reader
       could wait for. It is true on the tape today, and it was
       printed under the heading that says so — but the line itself
       did not say which list it came from, so nothing contradicted
       the misreading. A line that describes itself cannot be
       misfiled. */
    const render = (r: (typeof usable)[number]) =>
      `- [${r.c.activeNow ? "נכון עכשיו" : "אינו נכון עכשיו"}] ${r.c.label}: ${r.c.occurrences} מופעים · גבוה יותר ב-${Math.round(r.o!.up * 100)}% ` +
      `מול בסיס ${Math.round(r.o!.baselineUp * 100)}% · הפרש ${r.o!.liftPp >= 0 ? "+" : ""}${Math.round(r.o!.liftPp)} נק׳` +
      (Math.abs(r.o!.liftPp) < 10 ? " (לא הוסיף מידע)" : "");

    /* THE SHAPE OF THE MOVE, FOR THE CONDITIONS THAT ARE TRUE TODAY.

       "Higher 88% of the time" is the headline and it is the weakest
       number in the file. It cannot answer the question anybody looking
       at a chart actually has — how far, how wide, and how much of it
       was given back on the way — and a model handed only the headline
       will fill the gap from nowhere when asked.

       Spent on at most three conditions, because printing four extra
       lines for each of eight events turns a block a model reads
       carefully into one it skims.

       WHICH THREE WAS THE SECOND VERSION OF THIS. The first spent
       them on the active conditions alone, which sounded right and
       was measured wrong: on the day it was tried, TTWO had no
       active condition at all, so the distribution — the whole point
       of the addition — printed nowhere. Most days on most names are
       not an event, which is the finding this file exists to report,
       and a feature that only appears on the exceptions is a feature
       nobody sees.

       So: everything true today, then filled from the conditions
       that carry the most information whether or not they fired
       today. */
    const shape = (condition: ConditionRead, o: Outcome) => {
      const out: string[] = [];
      const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

      /* All four horizons, because a condition that pays over a week
         and gives it back over a quarter is a different fact from one
         that builds, and the month alone cannot tell them apart. */
      out.push(
        "  · לפי אופק: " +
          HORIZONS.map((d) => {
            const x = condition.outcomes.find((y) => y.days === d);
            if (!x || x.n < MIN_SAMPLE) return `${HORIZON_LABEL[d]} מדגם קטן`;
            return `${HORIZON_LABEL[d]} ${Math.round(x.up * 100)}% (בסיס ${Math.round(x.baselineUp * 100)}%)`;
          }).join(" · "),
      );

      out.push(
        `  · בחודש: תנועה חציונית ${pct(o.medianPct)} (בסיס ${pct(o.baselineMedianPct)})` +
          ` · המחצית האמצעית ${pct(o.p25Pct)} עד ${pct(o.p75Pct)}` +
          ` · המקרה הגרוע ${pct(o.worstPct)}`,
      );

      /* Absent on a stored file written before these were measured. The
         block says nothing rather than printing a zero a model would
         read as "it never went against you". */
      if (typeof o.medianAdversePct === "number" && typeof o.medianFavourablePct === "number") {
        out.push(
          `  · בדרך (לפני שהחודש נגמר): הירידה הגדולה חציונית ${pct(o.medianAdversePct)}` +
            ` (בסיס ${pct(o.baselineAdversePct)}) · העלייה הגדולה חציונית ${pct(o.medianFavourablePct)}` +
            ` (בסיס ${pct(o.baselineFavourablePct)})`,
        );
      }

      return out;
    };

    /* At most three, active first, then by how much the condition
       moved the needle either way. `Math.abs` on purpose: a condition
       that preceded a fall as reliably as another preceded a rise is
       equally informative, and sorting by the signed lift would have
       quietly shown only the encouraging ones. */
    const detailed = new Set(
      [
        ...active,
        ...waitable
          .slice()
          .sort((a, b) => Math.abs(b.o!.liftPp) - Math.abs(a.o!.liftPp)),
      ]
        .slice(0, 3)
        .map((r) => r.c.key),
    );

    if (active.length) {
      lines.push("נכון עכשיו על הנייר:");
      for (const r of active) {
        lines.push(render(r));
        if (detailed.has(r.c.key)) lines.push(...shape(r.c, r.o!));
      }
    } else {
      lines.push("אף תנאי נמדד אינו נכון בנר האחרון. רוב הימים אינם אירוע.");
    }

    if (waitable.length) {
      /* The honest answer to "where do I get in". Each one is an
         observable close that can be checked afterwards — it happened or
         it did not — which is the only kind of waiting this site will
         describe.

         NOT "events that have not happened yet", which is what this
         heading said first and is plainly false: a condition with
         forty-one occurrences has happened forty-one times. What has
         not happened is today. A reader told that a forty-one-time
         event never occurred has been handed a reason to distrust
         the count printed beside it. */
      lines.push(
        "\nתנאים שאינם נכונים בנר האחרון — אלה שאפשר להמתין להם, ומה הם היו שווים על הנייר הזה:",
      );
      for (const r of waitable.slice(0, 6)) {
        lines.push(render(r));
        if (detailed.has(r.c.key)) lines.push(...shape(r.c, r.o!));
      }
    }

    if (rates.caveats.length) {
      lines.push(`\nסייגים: ${rates.caveats.join(" ")}`);
    }
  } else {
    lines.push(
      "\nאין שיעורי בסיס מדודים לנייר הזה — הוא אינו ביקום המחקר של האתר. כל שאלה על 'כמה פעמים זה קרה' או 'מה בא אחרי' אין לה תשובה נמדדת כאן.",
    );
  }

  /* ---- What is happening at the company ---- */
  lines.push(...contextLines(checked));

  /* ---- The stance, private build only ---- */
  if (isPrivateBuild()) lines.push(...stanceLines(checked));
  /* The risk arithmetic, so "where is the stop" stops being a refusal.
     Private only and for the same reason the panel is: measured, but
     measured for a decision. */
  if (isPrivateBuild()) lines.push(...planLines(checked));

  /* LAST, AFTER THE STANCE IT IS READ AGAINST.
     "Two of the three names you follow lean the same way" only means
     anything once this chart's own lean has been stated, and placed
     before it the list would be a pile of other tickers. */
  if (watchlist) lines.push(...watchlistLines(watchlist, checked.ticker));

  /* LAST OF ALL. Every section above is about the instrument; this is
     the only one about the person holding it, and it changes how the
     sections above are read rather than adding another of them. */
  if (position) lines.push(...positionLines(position));

  return lines.join("\n");
}


/**
 * The company's dated events and the stories the site has read.
 *
 * The chart reader knew the candles and nothing else. It could not know
 * that a company has a product dated in February, so it read every
 * chart as though the next quarter were a blank page — and the reader
 * looking at it is asking both questions at once: what did this
 * pattern do fifty-three times, AND what happens when the thing ships.
 *
 * THE TWO ARE KEPT APART IN THE BLOCK AND THE MODEL IS TOLD WHY. A
 * chart figure is counted over ten years. A catalyst is dated, and
 * nothing here has measured what this company's shares did after its
 * last launch. Folding them into one sentence would dress a calendar
 * entry as a measurement, so the block labels each side and the prompt
 * forbids borrowing the chart's authority for the news.
 */
/**
 * The trend the picture showed, against the trend the candles support.
 *
 * First in the block, because it is the claim every line after it
 * assumes. An answer that opens "the stock is in an uptrend" on a chart
 * whose candles say otherwise is wrong in a way no later caveat
 * repairs, and the model has no way to know unless it is told before it
 * starts.
 *
 * The instruction attached to a contradiction is deliberately not "the
 * measurement wins". The image can be a different timeframe or a
 * different instrument, and a model ordered to overrule the picture
 * would start denying what it can see. It is told to say that the two
 * disagree, which is the true statement and the useful one.
 */
function trendLines(checked: Corroboration): string[] {
  const t = checked.trend;
  if (!t) return [];

  const READ: Record<string, string> = {
    uptrend: "מגמה עולה",
    downtrend: "מגמה יורדת",
    range: "טווח",
    unclear: "לא ברור",
  };
  const MEASURED: Record<string, string> = {
    uptrend: "מגמה עולה (המחיר מעל ממוצע 200 והממוצע עולה)",
    downtrend: "מגמה יורדת (המחיר מתחת לממוצע 200 והממוצע יורד)",
    mixed: "מעורבת — המחיר והממוצע הארוך לא מצביעים לאותו כיוון",
  };

  const out: string[] = ["\n=== המגמה: מה שנקרא מהתמונה מול מה שנמדד מהנרות ==="];
  out.push(`מהתמונה: ${READ[t.read] ?? t.read}.`);
  out.push(
    `מהנרות: ${t.measured ? MEASURED[t.measured] : "אין די היסטוריה כדי למדוד"}.`,
  );

  const figures: string[] = [];
  if (t.vsAveragePercent !== null) {
    figures.push(`מול ממוצע 200: ${t.vsAveragePercent.toFixed(1)}%`);
  }
  if (t.averageDirection) {
    const d =
      t.averageDirection === "rising"
        ? "עולה"
        : t.averageDirection === "falling"
          ? "יורד"
          : "שטוח";
    figures.push(`כיוון הממוצע: ${d}`);
  }
  if (t.fromHighPercent !== null) {
    figures.push(`משיא 52 שבועות: ${t.fromHighPercent.toFixed(1)}%`);
  }
  if (figures.length) out.push(figures.join(" · ") + ".");
  if (t.stage.stage !== null) out.push(`${t.stage.label}. ${t.stage.note}`);

  if (t.agreement === "contradicts") {
    out.push(
      "[סתירה] שתי הקריאות לא מתארות את אותו מבנה. אל תפתח את התשובה " +
        "בכיוון מהתמונה כאילו הוא מוסכם — אמור במפורש שהתמונה והנרות " +
        "חלוקים, ותן את שניהם. אל תכריע מי צודק: ייתכן שהצילום הוא של " +
        "אופק זמן אחר, של נייר אחר, או של חלון שהאתר לא מחזיק.",
    );
  } else if (t.agreement === "qualified") {
    out.push(
      "[סייג] הנרות לא סותרים את הקריאה אבל לא נותנים מגמה נקייה. אם " +
        "אתה מזכיר מגמה, הזכר גם שהמחיר והממוצע הארוך לא מצביעים לאותו " +
        "כיוון.",
    );
  } else if (t.agreement === "agrees") {
    out.push(
      "[מאושר] הקריאה מהתמונה והמדידה מהנרות מתארות את אותו מבנה.",
    );
  }

  return out;
}

/**
 * What else the reader follows, while they look at this one chart.
 *
 * The half of a decision a chart cannot contain. A direction on one
 * name is a reading; the same direction across everything the reader
 * holds is a concentrated position they did not notice assembling, and
 * both halves of that sentence were already on the site — the nightly
 * scan has every name's direction, the correlation matrix has every
 * pair — and nothing put them together.
 *
 * TWO FIGURES THAT MUST NOT BE CONFUSED, so the lines name both. Two
 * names leaning the same way is an agreement between two readings.
 * Two names that *move* together is a measured correlation over 104
 * weeks. The first can be coincidence; the second is the one that
 * decides whether a second position is a second bet. A model given
 * only the first will reach for the word "correlated", which is why
 * the correlation is printed whenever it exists.
 *
 * And both sides are dated. The chart's own stance is computed live
 * from fresh candles; these come from last night's build. Comparing
 * them without saying so would let the agent assert that two names
 * agree today when one of them was measured yesterday.
 */
function watchlistLines(
  watchlist: WatchlistContext,
  ticker: string,
): string[] {
  const { followed, sameDirection, withAnyDirection, closeMovers } = watchlist;
  const out: string[] = ["\n=== מה עוד במעקב של הקורא ==="];

  out.push(
    watchlist.isFollowed
      ? `${ticker} נמצאת ברשימת המעקב של הקורא.`
      : `${ticker} לא ברשימת המעקב של הקורא.`,
  );

  if (followed.length === 0) {
    out.push("אין נייר אחר במעקב. אל תדבר על תיק או על ריכוזיות.");
    return out;
  }

  out.push(
    `נוסף לזה במעקב: ${followed.map((f) => f.ticker).join(", ")}. ` +
      `הכיוונים למטה מהסריקה הלילית של ${watchlist.scanAsOf ?? "תאריך לא ידוע"} ` +
      "— לא מחושבים עכשיו, בניגוד לעמדה של הגרף שלמעלה.",
  );

  for (const f of followed) {
    const parts: string[] = [];
    if (f.swing) {
      parts.push(
        `סווינג ${f.swing.direction === "up" ? "למעלה" : f.swing.direction === "down" ? "למטה" : "חלוק"}` +
          (f.swing.lead ? ` (${f.swing.lead})` : ""),
      );
    }
    if (f.position) {
      parts.push(
        `טווח ארוך ${f.position.direction === "up" ? "למעלה" : f.position.direction === "down" ? "למטה" : "חלוק"}`,
      );
    }
    /* Said as a direction-shaped statement, not as an absence.
       "אין תנאי נמדד שפעל" is a true line that a model reads past: the
       answer came back describing two names with no direction at all
       as "both leaning down", which is the block's own words inverted.
       A line that states the conclusion — THERE IS NO DIRECTION — is
       harder to summarise into one. */
    if (parts.length === 0) {
      parts.push("אין כיוון — לא למעלה ולא למטה. שום תנאי נמדד לא פעל");
    }
    if (f.nextEarnings) {
      parts.push(`דוח ${f.nextEarnings.date} (בעוד ${f.nextEarnings.daysAway} ימים)`);
    }
    if (f.correlation !== null) {
      parts.push(`מתאם עם ${ticker}: ${f.correlation.toFixed(2)}`);
    }
    out.push(`- ${f.ticker}: ${parts.join(" · ")}`);
  }

  /* The count with its denominator, always. Three of three is a
     concentration; three of eleven is a coincidence, and one number
     cannot tell them apart. */
  if (withAnyDirection > 0) {
    out.push(
      `${sameDirection} מתוך ${withAnyDirection} הניירות במעקב שיש להם כיוון ` +
        `נוטים לאותו צד כמו ${ticker}.`,
    );
  } else {
    out.push(
      "**לאף נייר אחר במעקב אין כיוון נמדד היום. אל תכתוב שהם נוטים " +
        "למעלה או למטה — זו לא הסתייגות, זו עובדה על מה שנמדד.** " +
        "אם השאלה נוגעת אליהם, אמור שלא פעל בהם תנאי נמדד.",
    );
  }

  if (closeMovers.length) {
    out.push(
      `נעים יחד עם ${ticker} לפי מדידה (מתאם תשואות שבועיות על ` +
        `${watchlist.correlationWeeks ?? "—"} שבועות): ` +
        closeMovers
          .map((m) => `${m.ticker} ${m.correlation.toFixed(2)}`)
          .join(", ") +
        ". זה מדוד, בניגוד להסכמה בין כיוונים — ולכן זה מה שקובע אם " +
        "פוזיציה שנייה היא הימור שני או אותו הימור פעמיים.",
    );
  }

  /* The instruction has to name the figure, not the topic. The first
     version said "use this if asked about concentration" and the model
     answered a concentration question — "does this add anything or is
     it more of the same" — by comparing which conditions fired, with
     the measured correlation printed two lines above and unused.
     Agreement between directions is the weaker evidence and the more
     available one, so it gets reached for unless the stronger one is
     asked for by name. */
  out.push(
    "**לשאלה על התיק, על ריכוזיות, או על ״האם זה עוד מאותו דבר״ — צטט " +
      `את המתאם המדוד מול ${ticker} במספרים.** הוא הדבר שמכריע אם פוזיציה ` +
      "שנייה היא הימור שני או אותו הימור פעמיים, והסכמה בין כיוונים אינה " +
      "תחליף לו: שני ניירות יכולים לנטות לאותו צד ולזוז בנפרד, ולהפך. " +
      "בשאלות אחרות השתמש בחלק הזה רק אם הוא רלוונטי לשאלה. אל תמציא " +
      "מתאם שלא מודפס כאן, ואל תקרא להסכמה בין כיוונים ״מתאם״.",
  );

  return out;
}

function contextLines(checked: Corroboration): string[] {
  const context = checked.context;
  if (!context) return [];

  const out: string[] = [];
  const { nextEarnings, stories } = context;

  if (!nextEarnings && stories.length === 0) {
    return [
      "\nאין לאתר אירוע מתוזמן או כתבה מנותחת על הנייר הזה כרגע. אל תמציא סיבה עסקית לתנועה.",
    ];
  }

  out.push("\n=== מה שקורה בחברה (לא נמדד על הגרף) ===");
  out.push(
    "הצד הזה מתוארך ולא ספור: האתר יודע מתי האירוע, ולא מה קרה למניה אחרי " +
      "אירועים דומים בעבר. אל תיתן לו את הביטחון של שיעורי הבסיס.",
  );
  /* A story reaches this list because it is about this company, and that
     is not the same as being about it alone. The summaries are written
     per article, so one piece covering two companies carries both their
     catalysts in a single paragraph — "for GameStop the warrant deadline,
     for Take-Two the GTA VI launch" arrived exactly that way. The split
     cannot be made in the data, so it is named here instead of papered
     over: attributing another company's catalyst to this chart is the one
     failure that reads as evidence. */
  out.push(
    `כתבה יכולה לכסות כמה חברות. ייחס רק את החלק שמדבר על ${checked.ticker} — ` +
      "אם הזרז מתאר חברה אחרת, אל תייחס אותו לנייר הזה, וגם אל תזכיר אותו כסיבה. ליד כתבה כזאת מודפסות החברות הנוספות שהקריאה מזכירה.",
  );

  if (nextEarnings) {
    out.push(
      `דוח רבעוני: ${nextEarnings.date}, בעוד ${nextEarnings.daysAway} ימים.`,
    );
  }

  for (const story of stories) {
    out.push(
      `- [${story.significance === "high" ? "השפעה גבוהה" : story.significance === "medium" ? "השפעה בינונית" : "השפעה נמוכה"}]` +
        `${story.catalystKind === "catalyst" ? " [זרז]" : ""} ${story.title}` +
        /* The other companies the reading names, printed before the
           catalyst rather than after it. A model reading "the upgrade
           points to a new growth engine" has no way to know that
           sentence was written about Fastly unless the names arrive
           first. */
        (story.otherTickers.length > 0
          ? `\n  הכתבה מזכירה גם: ${story.otherTickers.slice(0, 4).join(", ")} — ודא למי מהן הזרז שייך לפני שאתה מייחס אותו ל-${checked.ticker}.`
          : "") +
        (story.catalyst ? `\n  הזרז: ${story.catalyst}` : "") +
        `\n  ההשפעה כפי שנקראה: ${story.impact}`,
    );
  }

  return out;
}

/**
 * The stance, as lines the model may state a direction from.
 *
 * RECOMPUTED HERE RATHER THAN READ FROM THE POSTED BODY, and that
 * distinction is the whole reason this is a function instead of a field
 * on `Corroboration`. `ChartAsk` posts the corroboration back to the
 * route, and the route's comment is right that posted MEASUREMENTS are
 * not a trust boundary: the worst a tampered body can do is describe a
 * chart that does not exist, to the person who tampered with it.
 *
 * A posted CONCLUSION is a different object. It would arrive with no
 * numbers behind it and the model would read it out as the site's view.
 * So the direction is derived server-side from the measurements in the
 * body, by the same pure function the panel uses: the panel and the
 * answer cannot disagree, and nothing a client sends can invent a view.
 */
function stanceLines(checked: Corroboration): string[] {
  const stance = buildChartStance({
    setup: checked.setup,
    baseRates: checked.baseRates,
    lastClose: checked.lastClose,
  });

  if (!stance) {
    return [
      "\nאין עמדה לנייר הזה: הוא אינו ביקום המחקר של האתר, והאתר לא ספר עליו דבר. אל תאמר לאן הוא נוטה.",
    ];
  }

  const out: string[] = [
    "\n=== עמדה שהקוד גזר מהספירה ===",
    "זה המקום היחיד שממנו מותר לקחת כיוון. הכיוון חושב בקוד משיעורי הבסיס של הנייר עצמו — אל תמציא כיוון אחר, ואל תחזק אותו ממה שכתוב כאן.",
  ];

  for (const h of [stance.swing, stance.position] as HorizonStance[]) {
    out.push(
      `\n[${HORIZON_NAME[h.horizon]} · ${HORIZON_SPAN[h.horizon]}] ${directionLabel(h)}.`,
    );
    /* The one sentence written so its strength matches its evidence.
       It existed in the engine and reached nothing — not this block and
       not the panel — so the model saw only the heading above, took the
       confident reading of it, and answered "the record leans down" on
       charts that have no record. A line the engine writes carefully
       and nobody prints is the same as a line nobody wrote. */
    out.push(`פסק: ${h.verdict}`);
    /* And the answer to "now or wait", which is the question people
       ask a chart and the block used to supply every ingredient of
       without ever stating. */
    out.push(`עכשיו מול המתנה: ${h.timing}`);
    if (h.baseline) {
      out.push(
        `יום שרירותי על הנייר באותו חלון: ${Math.round(h.baseline.upShare * 100)}% סגרו גבוה יותר.`,
      );
    }
    for (const line of h.because) out.push(`· בעד: ${line}`);
    for (const line of h.against) out.push(`· נגד: ${line}`);
    for (const line of h.invalidation) out.push(`· מפריך: ${line}`);
    for (const r of h.route) {
      out.push(
        `· מסלול ${r.order} [${ROUTE_KIND_NAME[r.kind]}] ${r.label}: ${r.detail}`,
      );
    }
    out.push(h.basis);
  }

  /* When the horizons disagree that is the most useful line here, and a
     model will not notice it unless the block says so in words. */
  /* One of them being `none` is the MOST interesting version of this,
     not an exclusion. BKNG today leans up over three weeks on a 24-point
     gap and reports nothing at all over a quarter, because the same
     condition is worth two points at 63 days. That is the answer to
     "swing or long term" and the first draft of this condition skipped
     it by requiring both horizons to have a direction. */
  if (stance.swing.direction !== stance.position.direction) {
    out.push(
      "\nשים לב: שני האופקים לא מסכימים. אלה שתי מדידות של חלונות שונים, וההבדל ביניהן הוא התשובה לשאלה לאיזה טווח מדובר.",
    );
  }

  return out;
}

/**
 * The questions people actually ask, offered rather than waited for.
 *
 * A blank box under a chart gets used by almost nobody. These are the
 * four a reader has after an explanation, phrased so the answer is one
 * the block can support — including the entry-point question, which is
 * asked here as "what can be waited for" because that is the version with
 * a measurement behind it.
 */
export const CHART_QUESTIONS = [
  "מה בעצם קורה כאן בגרף?",
  "מה אפשר להמתין לו, וכמה פעמים זה קרה בעבר?",
  "איפה הקריאות סותרות זו את זו?",
  "מה המחזור מוסיף למה שהמחיר מראה?",
  /* The question a person about to act actually has, and the one the
     block could not answer until the distribution was put into it: not
     "will it go up" but "how far did this usually travel, and how much
     of it was given back on the way". */
  "מה הסטטיסטיקה של המצב הזה — כמה זה זז, וכמה זה ירד בדרך?",
];

/**
 * Rejects an answer that calls a base rate a success rate.
 *
 * The figure is a count of sessions that closed higher than the one the
 * condition fired on. Nobody succeeded at anything — there was no
 * entry, no exit and no position — and the word turns a measurement
 * into a claim about a strategy that was never run. It is also the
 * single easiest slip for a model to make, because every other context
 * it has seen a percentage beside a trading signal in called it that.
 *
 * Matched against the word near a number rather than the exact phrase
 * the prompt banned: the prompt forbade "שיעור הצלחה" and the answer
 * came back "70% הצלחה", which obeys the letter and breaks the point.
 * Plain prose about a product launch succeeding is left alone, because
 * the digit has to be within a few characters.
 */
export function callsItSuccess(text: string): string | null {
  const near = /(\d\s*%[^.\n]{0,24}הצלחה)|(הצלחה[^.\n]{0,24}\d\s*%)|שיעור\s+הצלחה|אחוז\s+הצלחה/;
  return near.test(text)
    ? 'answer called a base rate a "success rate"'
    : null;
}

/**
 * The risk arithmetic, as lines the model may quote.
 *
 * "Where do I put the stop" used to be answered with a refusal, and the
 * refusal was wrong: the site measures both inputs a stop needs. What
 * it cannot do is size the position, and that one stays a refusal
 * because the missing number is the reader's own risk budget and no
 * amount of candle history supplies it.
 *
 * Recomputed here from the posted measurements, like the stance, so the
 * panel and the answer cannot disagree and nothing a client sends can
 * invent a level.
 */
function planLines(checked: Corroboration): string[] {
  const stance = buildChartStance({
    setup: checked.setup,
    baseRates: checked.baseRates,
    lastClose: checked.lastClose,
  });
  const lead =
    stance?.swing.agreeing[0] ?? stance?.position.agreeing[0] ?? null;

  const plan = buildTradePlan({
    lastClose: checked.lastClose,
    asOf: checked.baseRates?.to ?? "",
    levels: checked.realLevels,
    atr: checked.atr,
    lead,
  });
  if (!plan) return [];

  const out: string[] = ["\n=== איפה זה נשבר, ובאיזה מחיר ==="];
  out.push(
    `הפניה ${plan.reference.toFixed(2)} (סגירה יומית של ${plan.asOf}). ` +
      `סטופ ${plan.stop.toFixed(2)}, סיכון ${plan.riskPercent.toFixed(1)}% — ${plan.stopReason}`,
  );
  out.push(
    "יעדים ככפולות של הסיכון, ולא מחירים שנמדדו: " +
      plan.targets
        .map((t) => `${t.multiple}R=${t.price.toFixed(2)}`)
        .join(" · ") +
      ".",
  );
  if (plan.measuredMove) {
    out.push(
      `התנועה החציונית שנמדדה אחרי התנאי: ${plan.measuredMove.percent.toFixed(1)}% ` +
        `(${plan.measuredMove.price.toFixed(2)}). זה נמדד — הכפולות שמעל לא.`,
    );
  }
  if (plan.survival) out.push(plan.survival.note);
  out.push(plan.sizing);
  out.push(
    "**לשאלה ״איפה הסטופ״ או ״איפה להיכנס״ — ענה מהשורות האלה במספרים. " +
      "אל תסרב.** הסירוב היחיד שנשאר הוא גודל פוזיציה, ושם הסיבה היא " +
      "שחסר מספר שלו — כמה הוא מוכן להפסיד — ולא שהאתר לא מודד.",
  );
  return out;
}

/**
 * Rejects an answer that ignored the length ceiling by a wide margin.
 *
 * A backstop and not the mechanism: the prompt asks for five sentences
 * and this fires at ten, because rejecting a six-sentence answer would
 * spend a retry on something a reader would never notice while risking
 * the whole answer on a model that keeps landing at six.
 *
 * It exists because the block keeps growing — levels, the tape day by
 * day, the stop, the reader's own holdings — and every addition is an
 * addition to the accuracy available, not to the length wanted. Without
 * a floor under the rule, each new section quietly bought itself another
 * paragraph: measured at 80 words when the length rule landed and 115
 * two sections later, with the rule unchanged.
 */
export function tooLong(text: string): string | null {
  /* Hebrew sentences end on a full stop, question or exclamation mark.
     Decimals are the trap — "5.8%" is not two sentences — so a digit on
     both sides of the stop does not end one. */
  const sentences = text
    .replace(/(\d)\.(\d)/g, "$1·$2")
    .split(/[.!?]+\s/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sentences.length > 10
    ? `answer ran to ${sentences.length} sentences against a ceiling of five`
    : null;
}

/**
 * The reader's own position, when they have told the page about it.
 *
 * Last in the block, because every figure above it is about the
 * instrument and this is the only one about the person holding it — and
 * because it changes what the figures above MEAN rather than adding
 * another. A stop at 211 is protection at a cost of 204 and a profit
 * give-back at a cost of 226, and the same number is being read two
 * ways.
 *
 * Nothing here is estimated. The cost basis is the one input candles
 * cannot supply, and everything after it is arithmetic.
 */
export function positionLines(read: PositionRead): string[] {
  const out: string[] = ["\n=== הפוזיציה של הקורא ==="];
  out.push(
    `נכנס ב-${read.entry.toFixed(2)}, הסגירה האחרונה ${read.last.toFixed(2)} — ` +
      `${read.returnPercent >= 0 ? "+" : ""}${read.returnPercent.toFixed(1)}%` +
      (read.returnValue !== null
        ? ` (${read.returnValue >= 0 ? "+" : ""}${read.returnValue.toFixed(0)} דולר על ${read.shares} מניות)`
        : "") +
      ".",
  );
  out.push(
    read.stopProtects === "gain"
      ? `הסטופ שבתוכנית נמצא מעל מחיר הכניסה (${read.stopFromEntryPercent >= 0 ? "+" : ""}${read.stopFromEntryPercent.toFixed(1)}% ממנו). ` +
        "כלומר הוא כבר לא מגן על הכסף אלא על רווח שנצבר — פגיעה בו סוגרת את הפוזיציה בירוק. " +
        "זה הבדל מהותי מהמצב של מי ששוקל להיכנס עכשיו, ואסור לתאר אותו כסיכון להפסד."
      : `הסטופ שבתוכנית נמצא מתחת למחיר הכניסה (${read.stopFromEntryPercent.toFixed(1)}% ממנו). ` +
        "פגיעה בו סוגרת את הפוזיציה הזאת בהפסד, והמספר הזה הוא ההפסד בפועל — " +
        "לא אחוז הסיכון שמחושב מהסגירה האחרונה.",
  );
  if (read.levelsBetween.length) {
    out.push(
      "רמות נמדדות בין מחיר הכניסה לסגירה האחרונה: " +
        read.levelsBetween
          .map((l) => `${l.price.toFixed(2)} (${l.touches} סווינגים)`)
          .join(", ") +
        ". אלה הרמות שהמחיר צריך לעבור בדרך חזרה.",
    );
  }
  if (read.versusMedian) out.push(read.versusMedian.note);
  out.push(
    "**כששואלים ״מה לעשות עם הפוזיציה״ — ענה מהמספרים האלה, לא מהתוכנית " +
      "שמחושבת מהסגירה האחרונה.** מי שכבר מחזיק שואל שאלה אחרת ממי ששוקל " +
      "להיכנס, גם כשהמילים זהות.",
  );
  return out;
}

/**
 * The chart answer's rejections, with length allowed to bite only once.
 *
 * A fresh closure per request, because the count is per answer and a
 * module-level counter would leak one reader's retries into the next
 * reader's first attempt.
 */
export function lengthRejectedOnce(): (text: string) => string | null {
  let lengthRejections = 0;
  return (text: string) => {
    /* Always. A wrong label is worse than no answer. */
    const wrong = callsItSuccess(text);
    if (wrong) return wrong;
    /* Once. A long answer is worse than a short one and better than
       none, so this buys a single retry and then gets out of the way. */
    if (lengthRejections === 0) {
      const long = tooLong(text);
      if (long) {
        lengthRejections++;
        return long;
      }
    }
    return null;
  };
}
