"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * The door.
 *
 * It replaces a two-clip film that played before anyone could reach the
 * site. The film was the better demo and the worse door: it cost 12MB
 * before a single figure loaded, it had to be sat through, and the only
 * way past it was to wait or to find the skip. This is one screen, and the
 * only way through is the button — which was the explicit brief: without
 * pressing it there is no entry.
 *
 * Rendered by default rather than after a check, which is the whole point:
 * a gate that waits for JavaScript to decide shows the page it is meant to
 * be covering first. Anyone who has already come through loses it on
 * mount instead — one frame for them, nothing for everybody else.
 *
 * Two ways out, because a door that opens one way is a trap: the button,
 * and reduced motion, which is answered before anything animates. There is
 * deliberately no skip link — the brief was that the button is the entry,
 * and a second quieter way past it would just be the old film's skip
 * wearing different words.
 */

const KEY = "market-intel:welcome:v1";

/** The launch story brings its own door and two in a row is one too many. */
const HAS_OWN_GATE = ["/launch/"];

export function WelcomeGate() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let passed = false;
    try {
      passed = window.sessionStorage.getItem(KEY) === "1";
    } catch {
      /* Private browsing refuses the read. The door simply opens. */
    }
    setOpen(passed);
    setReady(true);
  }, []);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const pass = useCallback(() => {
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* Not remembering is survivable; blocking on it is not. */
    }
    setOpen(true);
  }, []);

  /**
   * The address is required to get through, and never required to arrive.
   *
   * Those are two different things and the difference is the whole design.
   * The form asks, records, and asks the owner to approve — and then opens
   * the door regardless of what the server said. A reader who typed a real
   * address and hit a database that is not configured, a mail service with
   * no key, or simply a bad minute, must not be left standing outside a
   * site that has nothing to do with any of it. What fails is the alert,
   * which is what the message then says.
   *
   * It also means the door cannot lock anybody out while the owner is
   * still setting the two keys up — including the owner.
   */
  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (sending) return;

      const address = email.trim();
      if (!address) {
        setNote("צריך כתובת מייל כדי להיכנס.");
        return;
      }
      /* The same shape the server checks, so the common mistake is caught
         before a request rather than after one. */
      if (!/^[^s@]+@[^s@]+.[^s@]{2,}$/.test(address)) {
        setNote("הכתובת לא נראית תקינה. בדקו שוב.");
        return;
      }

      setSending(true);
      try {
        await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: address }),
        });
      } catch {
        /* Offline, blocked, or the route is down. The door still opens. */
      }
      pass();
    },
    [email, sending, pass],
  );

  /* The scroll lock belongs to the gate and has to come off with it,
     including when the gate never mounts because the page has its own. */
  useEffect(() => {
    const locked = ready && !open && !HAS_OWN_GATE.some((p) => path?.startsWith(p));
    /* On <body> alone this did nothing: the document element is what
       scrolls here, so the page went on moving underneath a door that was
       supposed to be holding it still. Measured, not assumed — the gate
       was up, body said overflow:hidden, and window.scrollTo still moved
       the page. */
    const root = document.documentElement;
    document.body.style.overflow = locked ? "hidden" : "";
    root.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
      root.style.overflow = "";
    };
  }, [ready, open, path]);

  if (HAS_OWN_GATE.some((prefix) => path?.startsWith(prefix))) return null;
  if (open) return null;

  return (
    <div className="welcome-gate" role="dialog" aria-modal="true" aria-label="ברוכים הבאים">
      <div className="welcome-field" aria-hidden="true">
        <i className="welcome-light welcome-light--one" />
        <i className="welcome-light welcome-light--two" />
        <i className="welcome-grain" />
      </div>

      <div className="welcome-inner">
        <span className="welcome-eyebrow">MARKET INTEL</span>

        {/* The owner's own picture, supplied for this door and confirmed as
            theirs. It replaces the drawn bird and the generated pile of
            notes: this one frame already is the bird, the money and the
            vault, and keeping the drawn dollars behind it would have been a
            second pile of money under a photograph of a pile of money.

            Sized against the VIEWPORT height, not just its width. The file
            is a 1122×1402 portrait, and a picture scaled by width alone
            pushes the entry button off a laptop screen — which is exactly
            how the door became impossible to open. `priority` because this
            is the first and only thing on the screen; there is nothing it
            could be competing with. */}
        <div className="welcome-bird">
          <Image
            src="/welcome/duck.webp"
            alt=""
            width={1122}
            height={1402}
            priority
            sizes="(max-width: 600px) 72vw, 380px"
            className="welcome-photo"
          />
        </div>

        <h1 className="welcome-title">
          ברוכים הבאים
          <br />
          <em>לעולם הכי יפה בעולם</em>
          <br />
          <span>שוק ההון</span>
        </h1>

        <p className="welcome-lede">
          נתונים רשמיים, מחקר מבוסס מקורות, וזירה אחת שמחברת ביניהם.
        </p>

        {/* noValidate so this form answers in its own language. The
            browser blocks a submit on type="email" + required before the
            handler runs, and then explains it in the browser UI language —
            on an RTL Hebrew door that is a tooltip in English pointing at
            the wrong edge of the field. The checks below are the same ones,
            and the server repeats them regardless. */}
        <form className="welcome-form" onSubmit={submit} noValidate>
          <label className="sr-only" htmlFor="welcome-email">
            כתובת מייל
          </label>
          <input
            id="welcome-email"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            required
            dir="ltr"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (note) setNote(null);
            }}
            className="welcome-input num"
          />
          <button type="submit" className="welcome-enter" disabled={sending}>
            <span>{sending ? "רגע…" : "לכניסה"}</span>
            <i aria-hidden="true">←</i>
          </button>
        </form>

        {note && (
          <p className="welcome-alert" role="alert">
            {note}
          </p>
        )}

        <p className="welcome-note">
          הכתובת משמשת להתראות בלבד — תנועה חריגה, מועד מתקרב, כתבה מהותית —
          ונשלחת רק אחרי אישור בעל האתר. אפשר להסיר בכל רגע מכל הודעה.
          האתר אינו ייעוץ השקעות ואינו מחובר לברוקר.
        </p>
      </div>
    </div>
  );
}
