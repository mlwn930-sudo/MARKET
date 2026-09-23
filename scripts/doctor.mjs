/**
 * What is actually wrong, in one command.
 *
 *   npm run doctor
 *
 * Written after an afternoon spent working out why no article on the site
 * carried an analysis. The answer turned out to be two unrelated things,
 * neither of which announced itself: the scripts never read .env.local, so a
 * key sitting in that file was invisible to them; and the scheduled workflow
 * had stopped running, which looks exactly like a feed that is merely quiet.
 *
 * Every check below reports what it found and what to do about it. A check
 * that cannot reach the network says so rather than failing the run — this
 * is a diagnostic, and a diagnostic that crashes halfway through tells you
 * less than one that finishes with a gap in it.
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const amber = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

let problems = 0;

function ok(label, detail = "") {
  console.log(`${green("  ok")}  ${label}${detail ? dim(` — ${detail}`) : ""}`);
}
function warn(label, detail, fix) {
  console.log(`${amber("warn")}  ${label}${detail ? dim(` — ${detail}`) : ""}`);
  if (fix) console.log(`        ${dim(fix)}`);
}
function fail(label, detail, fix) {
  problems++;
  console.log(`${red("fail")}  ${label}${detail ? dim(` — ${detail}`) : ""}`);
  if (fix) console.log(`        ${dim(fix)}`);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(resolve(ROOT, path), "utf8"));
  } catch {
    return null;
  }
}

const ageHours = (iso) =>
  iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : null;

console.log("\nMarket Intel — בדיקת מצב\n");

/* ---- Keys ---- */

console.log(dim("מפתחות"));

const KEYS = [
  {
    name: "FINNHUB_API_KEY",
    needed: "מחירים חיים, גרפים וחדשות",
    where: "finnhub.io/register",
    required: true,
  },
  {
    name: "GEMINI_API_KEY",
    needed: "ניתוח הכתבות בשלוש עדשות",
    where: "aistudio.google.com/apikey",
    required: false,
  },
  {
    name: "SEC_USER_AGENT",
    needed: "דוחות SEC — חובה לפי תנאי השימוש שלהם",
    where: "פורמט: שם ומייל",
    required: true,
  },
  {
    name: "FRED_API_KEY",
    needed: "ריבית חסרת סיכון ל-WACC",
    where: "fredaccount.stlouisfed.org/apikeys",
    required: false,
  },
];

for (const key of KEYS) {
  const value = process.env[key.name];
  if (value) {
    ok(key.name, key.needed);
  } else if (key.required) {
    fail(key.name, `חסר — ${key.needed}`, `השג ב-${key.where} והוסף ל-.env.local`);
  } else {
    warn(key.name, `חסר — ${key.needed}`, `השג ב-${key.where} והוסף ל-.env.local`);
  }
}

console.log(
  dim(
    "\n        המפתחות נקראים מ-.env.local מקומית, ומ-GitHub Secrets בהרצה\n" +
      "        המתוזמנת. שניהם נדרשים — אחד לא מחליף את השני.\n",
  ),
);

/* ---- The stored feed ---- */

console.log(dim("הפיד השמור"));

const feed = await readJson("content/news/latest.json");
const summaries = await readJson("content/news/summaries.json");

if (!feed) {
  fail("content/news/latest.json", "לא נמצא", "הרץ: npm run refresh:news");
} else {
  const articles = (feed.sectors ?? []).flatMap((s) => s.articles ?? []);
  const hours = ageHours(feed.refreshedAt);

  if (hours === null) {
    warn("latest.json", "אין חותמת זמן");
  } else if (hours > 6) {
    warn(
      "latest.json",
      `נכתב לפני ${hours.toFixed(1)} שעות · ${articles.length} כתבות`,
      "הקובץ הוא רשת הביטחון בלבד — העמוד מושך חדשות חיות מ-Finnhub.",
    );
  } else {
    ok("latest.json", `${articles.length} כתבות, בן ${hours.toFixed(1)} שעות`);
  }

  if (!summaries) {
    fail(
      "content/news/summaries.json",
      "לא נמצא",
      "הרץ: npm run summarize:news",
    );
  } else {
    const written = Object.keys(summaries.summaries ?? {});
    const urls = new Set(articles.map((a) => a.url));
    const covered = written.filter((url) => urls.has(url)).length;

    const withLenses = written.filter((url) => {
      const entry = summaries.summaries[url];
      return entry?.catalyst || entry?.reaction || entry?.chain;
    }).length;

    if (covered === 0 && articles.length > 0) {
      fail(
        "כיסוי הניתוח",
        `0 מתוך ${articles.length} כתבות בפיד מנותחות (${written.length} ניתוחים קיימים לכתבות ישנות)`,
        "הרץ: npm run summarize:news",
      );
    } else {
      ok("כיסוי הניתוח", `${covered} מתוך ${articles.length} כתבות`);
    }

    if (written.length > 0 && withLenses === 0) {
      warn(
        "שלוש העדשות",
        "הניתוחים הקיימים נכתבו לפני שהעדשות נוספו",
        "הרצה הבאה תכתוב אותן לכתבות חדשות.",
      );
    } else if (withLenses > 0) {
      ok("שלוש העדשות", `${withLenses} ניתוחים כוללים אותן`);
    }
  }
}

/* ---- The other built files ---- */

console.log(`\n${dim("קבצים בנויים")}`);

const universe = await readJson("content/fundamentals/universe.json");
if (!universe) {
  fail(
    "content/fundamentals/universe.json",
    "לא נמצא — הסורק והשוואת הסקטור לא יעבדו",
    "הרץ: npm run build:fundamentals",
  );
} else {
  const days = ageHours(universe.builtAt) / 24;
  const count = (universe.companies ?? []).length;
  if (days > 10) {
    warn("universe.json", `${count} חברות, בן ${days.toFixed(0)} ימים`, "הרץ: npm run build:fundamentals");
  } else {
    ok("universe.json", `${count} חברות`);
  }
}

const institutional = await readJson("content/institutional/latest.json");
if (!institutional) {
  warn(
    "content/institutional/latest.json",
    "לא נמצא — עמוד המעקב המוסדי יהיה ריק",
    "הרץ: npm run build:institutional",
  );
} else {
  ok("latest.json (13F)", `${(institutional.institutions ?? []).length} גופים`);
}

/* ---- Live sources ---- */

console.log(`\n${dim("מקורות חיים")}`);

if (process.env.FINNHUB_API_KEY) {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=NVDA&token=${process.env.FINNHUB_API_KEY}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (res.status === 429) {
      warn(
        "Finnhub REST",
        "429 — חריגה ממגבלת הקצב כרגע",
        "60 קריאות לדקה. אם זה חוזר, סגור לשוניות פתוחות של האתר.",
      );
    } else if (!res.ok) {
      fail("Finnhub REST", `HTTP ${res.status}`, "בדוק שהמפתח תקף.");
    } else {
      const quote = await res.json();
      ok("Finnhub REST", `NVDA ${quote.c}`);
    }
  } catch (error) {
    fail("Finnhub REST", error.message);
  }
} else {
  fail("Finnhub REST", "אין מפתח, מדלג");
}

if (process.env.GEMINI_API_KEY) {
  try {
    const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${process.env.GEMINI_API_KEY}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (res.ok) {
      ok("Gemini", `המודל ${model} זמין`);
    } else {
      fail(
        "Gemini",
        `HTTP ${res.status}`,
        "המפתח אינו תקף או שאין לו גישה למודל הזה.",
      );
    }
  } catch (error) {
    fail("Gemini", error.message);
  }
} else {
  warn("Gemini", "אין מפתח — הכתבות יקבלו סיווג ראשוני בלבד");
}

/* ---- The scheduled run ---- */

console.log(`\n${dim("ההרצה המתוזמנת")}`);
console.log(
  dim(
    "        לא ניתן לבדוק מכאן. פתח את לשונית Actions ב-GitHub וּודא:\n" +
      "        · שההרצה האחרונה אינה ישנה מהתדירות שהוגדרה\n" +
      "        · שלא נגמרו דקות ההרצה — ברפו פרטי יש 2,000 לחודש, וזה\n" +
      "          נגמר בשקט. רפו ציבורי מקבל דקות ללא הגבלה.\n" +
      "        · שהמפתחות מוגדרים תחת Settings → Secrets → Actions\n",
  ),
);

/* ---- Verdict ---- */

console.log(
  problems === 0
    ? green("\nהכול תקין.\n")
    : red(`\n${problems} תקלות שדורשות טיפול.\n`),
);
