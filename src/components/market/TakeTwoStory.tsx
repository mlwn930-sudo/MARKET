import { GtaCover } from "@/components/market/GtaCover";

/**
 * Three chapters, in the order they are read.
 *
 * This used to be a pinned scroll scene: the section locked to the screen
 * for two viewport-heights while the chapters cross-faded and the art
 * swapped underneath them. When it worked it was the best thing on the
 * site. It stopped working, and the failure was the worst kind — the pin
 * silently computed a runway of zero, so the section never locked, the
 * chapters never advanced, and a reader scrolling through got the first
 * chapter followed by two thousand pixels of empty background. Which is
 * exactly what it looks like when the rest of the page has been deleted.
 *
 * Two real causes were found and fixed on the way: the entrance animation
 * this site now runs on every section was being applied to ScrollTrigger's
 * own pin spacer, and a transform on that spacer re-parents the fixed
 * positioning the pin depends on; and the refresh that used to correct the
 * measurement lived in the cover component that was removed. Neither
 * brought the pin back, and the runway stayed at zero whether the end was
 * given as a percentage or as pixels.
 *
 * So the choreography goes. The three chapters lay out in normal flow,
 * every one of them always on the page, and the site's own scroll reveal
 * brings each in as it is reached. It is a smaller idea that is true every
 * time, which on a page whose subject is "check what you were told" is the
 * right trade.
 */

const scenes = [
  {
    label: "01 / THE WORLD",
    title: (
      <>
        שני אנשים.
        <br />
        עולם של ציפיות.
      </>
    ),
    text: "ג׳ייסון ולוסיה. וייס סיטי ומדינת ליאונידה. Rockstar בונה עולם שהקהל רוצה להיכנס אליו — וזאת נקודת הפתיחה, עוד לפני המספרים.",
    word: "LEONIDA",
    note: "העולם והדמויות · לפי Rockstar Games",
  },
  {
    label: "02 / THE BUSINESS",
    title: (
      <>
        מאחורי העולם הזה,
        <br />
        יש חברה ציבורית.
      </>
    ),
    text: "Rockstar היא חלק מ־Take-Two. לצד GTA נמצאים גם 2K ו־Zynga: משחקי ספורט, מובייל ועולמות מתמשכים. השקעה ב־TTWO היא השקעה בכל העסק.",
    word: "TTWO",
    note: "Rockstar Games / 2K / Zynga",
  },
  {
    label: "03 / THE INVESTMENT",
    title: (
      <>
        משחק גדול.
        <br />
        באיזה מחיר?
      </>
    ),
    text: "התלהבות היא התחלה. תשואה דורשת יותר: מכירות, רווחיות ותזרים ביחס לציפיות שכבר במחיר. מכאן עוברים מהסיפור אל מה שאפשר לבדוק.",
    word: "EXPECTATIONS",
    note: "מסגרת ניתוח · לא תחזית תשואה",
  },
];

/** The value chain, as three cards. They were the second half of the
 *  pinned scene and they are the clearest thing on this page: the game,
 *  the company, and what reaches a shareholder. */
const layers = [
  { eyebrow: "ROCKSTAR GAMES", mark: "GTA", note: "תרבות → מעורבות" },
  { eyebrow: "TAKE-TWO INTERACTIVE", mark: "TTWO", note: "מכירות → רווחיות" },
  { eyebrow: "THE SHAREHOLDER", mark: "תזרים.", note: "השקעה → ערך" },
];

export function TakeTwoStory({ release }: { release: string | null }) {
  return (
    <div className="take-two-story">
      <GtaCover release={release} />

      <section id="gta-world" className="story-flow" aria-label="מהעולם של GTA אל Take-Two">
        {scenes.map((scene, i) => (
          <article className="story-chapter" key={scene.label}>
            <div className="story-chapter-copy">
              <span className="micro-label" dir="ltr">
                {scene.label}
              </span>
              <h2>{scene.title}</h2>
              <p>{scene.text}</p>
              <div className="story-scene-note">{scene.note}</div>
              <span className="scene-word" dir="ltr" aria-hidden="true">
                {scene.word}
              </span>
            </div>

            <div className="story-chapter-art" aria-hidden={i !== 0}>
              {i === 0 && (
                <div className="story-art-built">
                  <span className="story-art-word" dir="ltr">LEONIDA</span>
                  <span className="story-art-sub">וייס סיטי · 19.11.2026</span>
                </div>
              )}

              {i === 1 && (
                <div className="story-financial">
                  {layers.map((layer) => (
                    <div className="business-layer" key={layer.mark}>
                      <span>{layer.eyebrow}</span>
                      <strong>{layer.mark}</strong>
                      <small>{layer.note}</small>
                    </div>
                  ))}
                </div>
              )}

              {i === 2 && (
                <div className="story-close">
                  <span className="micro-label" dir="ltr">
                    FROM STORY TO STATEMENT
                  </span>
                  <p>
                    מכאן והלאה העמוד לא מספר — הוא בודק. מה שנמצא בדוחות,
                    מה שעוד לא, ומה שהשוק כבר תמחר.
                  </p>
                  <a href="#investment">אל המחקר הפיננסי ↓</a>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      <div className="story-source">
        <span>
          איורים: © Rockstar Games · שימוש מערכתי לדיון בכותר ובחברה. MARKET הוא
          אתר עצמאי.
        </span>
        <a
          href="https://www.rockstargames.com/VI/only-in-leonida"
          target="_blank"
          rel="noopener noreferrer"
        >
          הסיפור במקור ↗
        </a>
      </div>
    </div>
  );
}
