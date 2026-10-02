import { DollarMotif } from "@/components/DollarMotif";
import { ReplayFilm } from "@/components/market/ReplayFilm";

/**
 * The cover of the GTA VI story.
 *
 * It used to be a WebGL sheet that shattered the artwork as you scrolled,
 * and the shattering was the whole idea: the story breaks, the thesis has
 * to hold. It read as an effect applied to a picture rather than a cover,
 * and it cost a Three.js scene, a texture upload and a pinned scroll on
 * the first screen of the page.
 *
 * What is left is the picture, framed and lit. The artwork is the draw —
 * it does not need to be broken to be looked at.
 *
 * Framed high on purpose: `object-position` sits well above centre because
 * both figures' heads are near the top edge of the original, and a cover
 * that crops to a short window takes its crop from there.
 */
export function GtaCover({ release }: { release: string | null }) {
  return (
    <header className="gta-cover" aria-label="GTA VI: מהסיפור להשקעה">
      {/* Built, not borrowed.

          This was Rockstar's official GTA VI key art, reproduced whole and
          served from this project's own host — on a site whose owner asked
          that nobody be able to bring a claim against it. Attribution was
          recorded in docs/, which is not permission and which no visitor
          ever sees. So the photograph is gone and the cover is made of the
          things this project owns: its own light, its own type, its own
          mark. A cover does not need someone else's picture to be one. */}
      <div className="gta-cover-field" aria-hidden="true">
        <i className="gta-field-one" />
        <i className="gta-field-two" />
        <i className="gta-field-grid" />
      </div>
      <div className="gta-cover-shade" aria-hidden="true" />

      {/* A genuinely dark opener, which is the one place this site allows
          light and depth. The mark sits in the gutter beside the copy, not
          under it, and there is no figure anywhere near it. */}
      <div className="gta-cover-mark" aria-hidden="true">
        <DollarMotif size={300} opacity={0.16} />
      </div>

      <div className="gta-cover-top">
        <span>MARKET STORIES / TAKE-TWO</span>
        {/* Only shown to someone who has already passed the door this
            session — see the component for why the page looked, to the
            owner, as though the film had been deleted. */}
        <ReplayFilm />
        <a href="#investment">למחקר הפיננסי ↙</a>
      </div>

      {/* The masthead is the company, not the game.

          It was "GTA VI" set at 190px — a trademark used as this page's own
          title, in the game's own pink-on-violet, which together read as a
          GTA page rather than as a page about the company that owns GTA.
          Naming a title you are analysing is ordinary journalism; wearing
          its mark as your own banner is not.

          So the ticker is the headline and the game is in the sentence
          under it, which is also the more honest description of the page:
          it is a Take-Two analysis that happens to be occasioned by a
          release. */}
      <div className="gta-cover-copy">
        <span className="gta-cover-kicker">סיפורי MARKET · ניתוח עצמאי</span>
        <h1 className="gta-cover-title" dir="ltr">
          TAKE<em>TWO</em>
        </h1>
        <p>
          השקה אחת של GTA VI.
          <br />
          <span>שרשרת ערך שלמה.</span>
        </p>
        <a className="gta-enter" href="#gta-world">
          אל הסיפור של Take-Two<span aria-hidden="true">↓</span>
        </a>
      </div>

      <div className="gta-cover-bottom">
        <div>
          <span>מועד ההשקה</span>
          <strong>{release ?? "טרם הוכרז"}</strong>
        </div>
        <a href="#investment">מה זה עושה לדוחות ↙</a>
        <span>NASDAQ / TTWO</span>
      </div>
    </header>
  );
}
