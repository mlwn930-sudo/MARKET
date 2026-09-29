"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A door with a film behind it.
 *
 * The site has one in front of everything, and the GTA VI page has its
 * own. Both behave the same way, which is the reason this is one
 * component and not two: a visitor who learns the door on the way in
 * should not have to learn a different one later.
 *
 * Rendered by default rather than after a check, which is the whole point:
 * a gate that waits for JavaScript to decide shows the page it is meant to
 * be covering first. Anyone who has already come through loses it on
 * mount instead — one frame for them, nothing for everybody else.
 *
 * Three ways out, because a door that can only be opened one way is a
 * trap: the button once the film has run, the skip at any moment, and
 * reduced motion, which is answered before a byte is fetched.
 */

export type Shot = {
  src: string;
  /**
   * Stop here instead of at the end of the file.
   *
   * Cutting in the player rather than in the file means the footage is
   * never re-encoded and the number can be changed in one place when the
   * edit turns out to be a beat early or late.
   */
  until?: number;
};

type Phase = "closed" | "playing" | "ready" | "open";

export function CinemaGate({
  shots,
  storageKey,
  eyebrow,
  title,
  readyTitle,
  lede,
  startLabel = "התחילו",
  enterLabel = "לכניסה",
  accent = "#7fd9ef",
  only,
}: {
  shots: Shot[];
  /** Per gate, so passing one does not silently open the other. */
  storageKey: string;
  eyebrow: string;
  title: [string, string];
  readyTitle: [string, string];
  lede?: string;
  startLabel?: string;
  enterLabel?: string;
  accent?: string;
  /**
   * Restrict this door to one kind of screen.
   *
   * A reel cut for a phone has no business filling a desktop, and the
   * reverse is worse. The hidden one is left in the tree rather than
   * branched away so there is no first-frame flash on the screen that
   * does want it. Its first clip drops to preload="metadata" rather
   * than "auto": enough for an opening frame to stand behind the words,
   * without the screen that will never show it pulling the whole file.
   */
  only?: "mobile" | "desktop";
}) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [shot, setShot] = useState(0);
  const [sound, setSound] = useState(true);
  const clips = useRef<(HTMLVideoElement | null)[]>([]);

  const toggleSound = useCallback(() => {
    setSound((on) => {
      clips.current.forEach((clip) => {
        if (clip) clip.muted = on;
      });
      return !on;
    });
  }, []);

  useEffect(() => {
    let alreadyIn = false;
    try {
      alreadyIn = window.sessionStorage.getItem(storageKey) === "1";
    } catch {
      /* Private browsing refuses the read. The door simply opens. */
    }
    const stillness = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (alreadyIn || stillness) setPhase("open");
  }, [storageKey]);

  const enter = useCallback(() => {
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      /* Not remembering is survivable; blocking on it is not. */
    }
    setPhase("open");
  }, [storageKey]);

  /**
   * The press is what buys the sound.
   *
   * A browser will not let a page make noise on its own, and it is right
   * not to. It will let it as the direct result of a press, which is the
   * only way this film ever starts — so the reel is unmuted here, inside
   * the gesture, and nowhere else. If sound is refused the film plays
   * silent rather than not at all.
   */
  const start = useCallback(() => {
    setPhase("playing");
    const first = clips.current[0];
    if (!first) {
      setPhase("ready");
      return;
    }
    clips.current.forEach((clip) => {
      if (clip) clip.muted = false;
    });
    first.play().catch(() => {
      clips.current.forEach((clip) => {
        if (clip) clip.muted = true;
      });
      setSound(false);
      first.play().catch(() => setPhase("ready"));
    });
  }, []);

  /**
   * The handover.
   *
   * The clip that just finished stays on screen, paused on its last
   * frame, and the next is raised over it. If the next needs a frame to
   * start, what shows underneath is the frame it was about to start on —
   * so a slow device sees a still, never a gap or a flash of black.
   */
  const advance = useCallback((finished: number) => {
    const next = clips.current[finished + 1];
    if (!next) {
      setPhase("ready");
      return;
    }
    setShot(finished + 1);
    next.play().catch(() => setPhase("ready"));
  }, []);

  /* Everything remaining downloads from the first press — not one ahead.
     One ahead is enough when a join is four seconds away; it is not when
     a later clip is twenty megabytes and the connection is a phone.
     Nothing is fetched before the press, so a skip still costs nothing. */
  useEffect(() => {
    if (phase !== "playing") return;
    clips.current.forEach((clip) => {
      if (clip && clip.preload !== "auto") {
        clip.preload = "auto";
        clip.load();
      }
    });
  }, [phase]);

  /* A stalled clip must not hold the door shut: one that overruns twice
     its own length hands on, and the last one opens the door. */
  useEffect(() => {
    if (phase !== "playing") return;
    const element = clips.current[shot];
    const stop = shots[shot]?.until;
    const length = stop ?? (Number.isFinite(element?.duration) ? element!.duration : 6);
    const timer = window.setTimeout(() => advance(shot), (length * 2 + 3) * 1000);
    return () => window.clearTimeout(timer);
  }, [phase, shot, advance, shots]);

  useEffect(() => {
    document.body.style.overflow = phase === "open" ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [phase]);

  if (phase === "open") return null;

  const heading = phase === "ready" ? readyTitle : title;

  return (
    <div
      className={`gate-shell fixed inset-0 z-[999] flex items-end justify-center overflow-hidden bg-black pb-[12vh] sm:pb-[14vh]${
        only === "mobile" ? " gate-shell--mobile" : only === "desktop" ? " gate-shell--desktop" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={eyebrow}
    >
      {/* The film is lifted rather than the page darkened, and with a gamma
          curve rather than a brightness multiplier: multiplying sends
          everything above about three-quarters to pure white and throws
          that detail away. A phone crops a 16:9 frame to a strip and
          magnifies it, so it gets more lift — for the cropping, not for
          taste. */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <filter id="gate-lift" colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="gamma" exponent="0.82" />
            <feFuncG type="gamma" exponent="0.82" />
            <feFuncB type="gamma" exponent="0.82" />
          </feComponentTransfer>
          <feColorMatrix type="saturate" values="1.06" />
        </filter>
        <filter id="gate-lift-small" colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="gamma" exponent="0.68" />
            <feFuncG type="gamma" exponent="0.68" />
            <feFuncB type="gamma" exponent="0.68" />
          </feComponentTransfer>
          <feColorMatrix type="saturate" values="1.08" />
        </filter>
      </svg>
      <style>{`
        .gate-clip { filter: url(#gate-lift); }
        @media (max-width: 640px) {
          .gate-clip { filter: url(#gate-lift-small); }
        }
        @media (min-width: 641px) { .gate-shell--mobile { display: none; } }
        @media (max-width: 640px) { .gate-shell--desktop { display: none; } }
        @supports not (filter: url(#gate-lift)) {
          .gate-clip { filter: brightness(1.14) contrast(1.02); }
        }
      `}</style>


      {shots.map((clip, i) => (
        <video
          key={clip.src}
          ref={(el) => {
            clips.current[i] = el;
            /* Muted at rest and set imperatively from here on. Left as a
               prop, React puts it back on the next render — and the reel
               re-renders at every handover, so the film would fall silent
               at the first join. */
            if (el && !el.dataset.primed) {
              el.dataset.primed = "1";
              el.muted = true;
            }
          }}
          src={clip.src}
          className="gate-clip absolute inset-0 h-full w-full object-cover"
          style={{ opacity: i <= shot ? 1 : 0, zIndex: i + 1 }}
          playsInline
          preload={i === 0 ? (only ? "metadata" : "auto") : "none"}
          onTimeUpdate={(event) => {
            const stop = clip.until;
            if (stop !== undefined && event.currentTarget.currentTime >= stop) {
              event.currentTarget.pause();
              advance(i);
            }
          }}
          onLoadedMetadata={(event) => {
            /* A browser given preload="metadata" knows the duration but
               paints nothing, so a gate that has not been pressed yet is
               a black rectangle. Asking for a frame by seeking to one
               forces the decode and gives the words something to stand
               on, without pulling the rest of the file. */
            if (i === 0 && event.currentTarget.currentTime === 0) {
              event.currentTarget.currentTime = 0.05;
            }
          }}
          onEnded={() => advance(i)}
          onError={() => advance(i)}
          aria-hidden="true"
        />
      ))}

      {/* Shade only where the words are. A vignette across the whole frame
          darkens the film to rescue the type; these shots are lit from the
          floor up, so the band has to be carrying its weight by the time it
          reaches the letters and gone before it touches the top. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[72%]"
        style={{
          zIndex: shots.length + 1,
          background:
            "linear-gradient(to top, rgba(4,10,20,.93) 0%, rgba(4,10,20,.86) 30%, rgba(4,10,20,.6) 55%, rgba(4,10,20,.2) 78%, transparent 100%)",
          opacity: phase === "playing" ? 0 : 1,
          transition: "opacity .6s",
        }}
        aria-hidden="true"
      />

      {/* The one control that stays while the film runs. Sound a visitor
          cannot stop is sound they resent. */}
      <button
        type="button"
        onClick={toggleSound}
        className="absolute end-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/35 text-white/85 backdrop-blur transition-colors hover:bg-black/60"
        style={{ zIndex: shots.length + 3 }}
        aria-label={sound ? "השתקת הקול" : "הפעלת הקול"}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
          {sound ? (
            <path
              d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M17 9.5l4.5 5M21.5 9.5l-4.5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      <div
        className={`relative flex flex-col items-center px-6 text-center transition-opacity duration-500 ${
          phase === "playing" ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        style={{ zIndex: shots.length + 2, textShadow: "0 2px 22px rgba(4,10,20,.85)" }}
      >
        <span className="text-[11px] tracking-[0.42em] text-white/75">{eyebrow}</span>

        <h1 className="mt-6 max-w-[16ch] text-[clamp(38px,7vw,86px)] font-semibold leading-[0.98] tracking-tight text-white">
          {heading[0]}
          <br />
          <em className="not-italic" style={{ color: accent }}>
            {heading[1]}
          </em>
        </h1>

        {phase === "closed" && lede && (
          <p className="mt-6 max-w-[34ch] text-[15px] leading-relaxed text-white/70">{lede}</p>
        )}

        <button
          type="button"
          onClick={phase === "ready" ? enter : start}
          className="mt-9 rounded-full bg-white px-9 py-4 text-[15px] font-medium text-[#0B1220] transition-transform hover:scale-[1.03]"
        >
          {phase === "ready" ? enterLabel : startLabel}
        </button>

        <button
          type="button"
          onClick={enter}
          className="mt-5 text-[13px] text-white/45 underline underline-offset-4 transition-colors hover:text-white/80"
        >
          דילוג
        </button>
      </div>

      {/* Nothing behind JavaScript should be unreachable. */}
      <noscript>
        <style>{`[role="dialog"][aria-modal="true"]{display:none!important}`}</style>
      </noscript>
    </div>
  );
}
