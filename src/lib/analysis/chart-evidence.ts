import { HORIZONS, MIN_SAMPLE } from "@/lib/metrics/base-rates";
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
export function chartEvidence(checked: Corroboration): string {
  const lines: string[] = [];

  lines.push(`נייר: ${checked.ticker}`);
  lines.push(`מחיר אחרון: ${checked.lastClose.toFixed(2)}`);
  lines.push(`נמדד על ${checked.candleCount} נרות יומיים.`);

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

  return lines.join("\n");
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
