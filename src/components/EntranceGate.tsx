"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The door.
 *
 * Not a section of the homepage — a gate in front of it. The site is
 * behind this, and the only way through is the button.
 *
 * Rendered by default rather than after a check, which is the whole point:
 * a gate that waits for JavaScript to decide shows the page it is meant to
 * be covering first. Visitors who have already come through this session
 * lose it on mount instead, which costs them one frame and nobody else
 * anything.
 *
 * Three ways out, because a door that can only be opened one way is a trap:
 *   the button, once the film has run;
 *   the skip, at any moment, for anyone who has seen it or cannot wait;
 *   and reduced motion, which is answered before a byte is fetched.
 *
 * It remembers for the session and not beyond. A visitor moving between
 * pages should not meet the door again; a visitor coming back tomorrow
 * should.
 */

const SEEN_KEY = "market-intel:entered:v1";

/**
 * The film, in order.
 *
 * Each clip was generated so its first frame is the previous clip's last
 * — which is what makes the join invisible, and why the handover below
 * can be a hard cut rather than a dissolve. Crossfading frame-matched
 * footage double-exposes it; switching on the frame does not.
 */
const REEL = ["/cinema/01-entrance.mp4", "/cinema/02-hall.mp4"];

type Phase = "closed" | "playing" | "ready" | "open";

export function EntranceGate() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [shot, setShot] = useState(0);
  const clips = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    let alreadyIn = false;
    try {
      alreadyIn = window.sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* Private browsing refuses the read. The door simply opens. */
    }
    const stillness = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (alreadyIn || stillness) setPhase("open");
  }, []);

  const enter = useCallback(() => {
    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* Not remembering is survivable; blocking on it is not. */
    }
    setPhase("open");
  }, []);

  /* The film only starts on a press, so the browser never has to guess
     whether autoplay was wanted, and thirty megabytes never begin
     downloading for someone who is going to skip. */
  const start = useCallback(() => {
    setPhase("playing");
    const first = clips.current[0];
    if (!first) {
      setPhase("ready");
      return;
    }
    first.play().catch(() => setPhase("ready"));
  }, []);

  /**
   * The handover.
   *
   * The clip that just finished is left on screen, paused on its last
   * frame, and the next one is raised over it. If the next needs a frame
   * to start, what shows underneath is the frame it was going to start
   * on — so a slow device sees a still, never a gap or a flash of black.
   */
  const advance = useCallback(
    (finished: number) => {
      const next = clips.current[finished + 1];
      if (!next) {
        setPhase("ready");
        return;
      }
      setShot(finished + 1);
      next.play().catch(() => setPhase("ready"));
    },
    [],
  );

  /* The clip after the one playing is fetched while it plays, so the join
     is never waiting on the network. */
  useEffect(() => {
    if (phase !== "playing") return;
    const upcoming = clips.current[shot + 1];
    if (upcoming && upcoming.preload !== "auto") {
      upcoming.preload = "auto";
      upcoming.load();
    }
  }, [phase, shot]);

  /* A stalled film must not hold the door shut. Each clip gets a budget
     of twice its own length; a clip that overruns it hands on, and the
     last one opens the door. */
  useEffect(() => {
    if (phase !== "playing") return;
    const element = clips.current[shot];
    const length = Number.isFinite(element?.duration) ? element!.duration : 6;
    const timer = window.setTimeout(() => advance(shot), (length * 2 + 3) * 1000);
    return () => window.clearTimeout(timer);
  }, [phase, shot, advance]);

  useEffect(() => {
    document.body.style.overflow = phase === "open" ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [phase]);

  if (phase === "open") return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="הכניסה ל-Market Intel"
    >
      {REEL.map((src, i) => (
        <video
          key={src}
          ref={(el) => {
            clips.current[i] = el;
          }}
          src={src}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            /* Past and present are lit; the future is not, or its first
               frame would cover the clip still running. */
            opacity: i <= shot ? 1 : 0,
            zIndex: i,
          }}
          muted
          playsInline
          preload={i === 0 ? "auto" : "none"}
          onEnded={() => advance(i)}
          onError={() => advance(i)}
          aria-hidden="true"
        />
      ))}

      {/* Legible over any frame the film happens to be on. */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: REEL.length,
          background:
            "radial-gradient(ellipse at center, rgba(4,10,20,.25), rgba(4,10,20,.82) 78%)",
          opacity: phase === "playing" ? 0 : 1,
          transition: "opacity .6s",
        }}
        aria-hidden="true"
      />

      <div
        className={`relative flex flex-col items-center px-6 text-center transition-opacity duration-500 ${
          phase === "playing" ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        style={{ zIndex: REEL.length + 1 }}
      >
        <span className="text-[11px] tracking-[0.42em] text-white/55">MARKET INTEL</span>

        <h1 className="mt-6 max-w-[16ch] text-[clamp(38px,7vw,86px)] font-semibold leading-[0.98] tracking-tight text-white">
          {phase === "ready" ? "הדלת פתוחה." : "מודיעין פיננסי,"}
          <br />
          <em className="not-italic text-[#7fd9ef]">
            {phase === "ready" ? "היכנסו." : "לפני שהשוק מדבר."}
          </em>
        </h1>

        {phase === "closed" && (
          <p className="mt-6 max-w-[34ch] text-[15px] leading-relaxed text-white/70">
            נתונים רשמיים, מחקר מבוסס מקורות, וזירה אחת שמחברת ביניהם.
          </p>
        )}

        <button
          type="button"
          onClick={phase === "ready" ? enter : start}
          className="mt-9 rounded-full bg-white px-9 py-4 text-[15px] font-medium text-[#0B1220] transition-transform hover:scale-[1.03]"
        >
          {phase === "ready" ? "לכניסה לאתר" : "התחילו"}
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
