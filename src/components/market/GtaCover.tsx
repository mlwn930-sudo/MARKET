import Image from "next/image";
import { DollarMotif } from "@/components/DollarMotif";

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
      <div className="gta-cover-photo">
        <Image
          src="/hero/rockstar-jason-lucia.webp"
          alt="GTA VI — האיור הרשמי של ג׳ייסון ולוסיה"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
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
        <a href="#investment">למחקר הפיננסי ↙</a>
      </div>

      <div className="gta-cover-copy">
        <span className="gta-cover-kicker">וייס סיטי. וול סטריט.</span>
        <h1 className="gta-cover-title" dir="ltr">
          GTA <em>VI</em>
        </h1>
        <p>
          העולם כבר נמכר.
          <br />
          <span>המספרים עוד לא.</span>
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
