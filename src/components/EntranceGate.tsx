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
 *   and reduced motion, which is answered before the film is ever fetched.
 *
 * It remembers for the session and not beyond. A visitor moving between
 * pages should not meet the door again; a visitor coming back tomorrow
 * should.
 */

const SEEN_KEY = "market-intel:entered:v1";

type Phase = "closed" | "playing" | "ready" | "open";

export function EntranceGate() {
  const [phase, setPhase] = useState<Phase>("closed");
  const video = useRef<HTMLVideoElement>(null);

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
     whether autoplay was wanted, and the download never begins for someone
     who is going to skip. */
  const start = useCallback(() => {
    setPhase("playing");
    const element = video.current;
    if (!element) {
      setPhase("ready");
      return;
    }
    element.play().catch(() => {
      /* A refused play is not a dead end — go straight to the way in. */
      setPhase("ready");
    });
  }, []);

  /* A film that stalls must not hold the door shut. Four seconds of
     footage gets eight before the way in appears anyway, so a dropped
     connection or a codec the browser will not touch costs the visitor a
     pause rather than the site. */
  useEffect(() => {
    if (phase !== "playing") return;
    const element = video.current;
    const budget = Number.isFinite(element?.duration) ? element!.duration * 2 + 2000 / 1000 : 12;
    const timer = window.setTimeout(() => setPhase("ready"), budget * 1000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "open") document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
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
      <video
        ref={video}
        src="/cinema/entrance.mp4"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          phase === "closed" ? "opacity-40" : "opacity-100"
        }`}
        muted
        playsInline
        preload="auto"
        onEnded={() => setPhase("ready")}
        onError={() => setPhase("ready")}
        aria-hidden="true"
      />

      {/* Legible over any frame the film happens to be on. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(4,10,20,.25), rgba(4,10,20,.82) 78%)",
        }}
        aria-hidden="true"
      />

      <div
        className={`relative flex flex-col items-center px-6 text-center transition-opacity duration-500 ${
          phase === "playing" ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
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
