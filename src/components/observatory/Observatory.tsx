"use client";

import { useEffect, useRef, useState } from "react";
import { ObservatoryFallback } from "./ObservatoryFallback";

/**
 * The hero object: a drawn observatory, with the 3D scene layered over it
 * when — and only when — the device, the connection and the reader's
 * preferences all say yes.
 *
 * The order matters and is the whole design. The SVG renders on the server
 * and is on screen in the first paint; the 3D runtime is never part of the
 * initial bundle and is only fetched after the hero is actually in view.
 * Nothing here can move the layout: the frame is a fixed square that both
 * states fill, so the headline beside it never reflows.
 *
 * Five separate ways this stays on the drawing, each one a real device
 * someone reads the site on:
 *
 *   NO SCENE URL — the scene has not been published yet. The page is
 *   complete without it, which is why this is a normal state and not an
 *   error.
 *
 *   REDUCED MOTION — a request not to animate is not satisfied by loading
 *   a megabyte of runtime and holding it still.
 *
 *   SMALL SCREEN — a phone gets the drawing. Shipping a WebGL runtime so a
 *   decorative object can spin behind a headline is the wrong trade on the
 *   device most likely to be on a metered connection.
 *
 *   SAVE-DATA OR A SLOW CONNECTION — the reader has told the browser what
 *   they want; the browser tells us.
 *
 *   NO WEBGL, OR SPLINE THROWS — the fallback is already underneath, so a
 *   failure is invisible rather than a hole in the page.
 */

type Phase = "static" | "loading" | "live";

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function connectionIsThin(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const c = nav.connection;
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === "slow-2g" || c.effectiveType === "2g" || c.effectiveType === "3g";
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function Observatory({
  sceneUrl,
  className = "",
}: {
  /** The published Spline scene. Absent is a supported state. */
  sceneUrl?: string;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("static");

  useEffect(() => {
    if (!sceneUrl) return;
    if (prefersReducedMotion()) return;
    if (window.innerWidth < 1024) return;
    if (connectionIsThin()) return;
    if (!hasWebGL()) return;

    const frame = frameRef.current;
    if (!frame) return;

    let disposed = false;
    /* The runtime's own type is only available after the dynamic import,
       and the module is deliberately not imported at the top level. */
    let app: { dispose?: () => void } | null = null;

    const start = async () => {
      if (disposed) return;
      setPhase("loading");
      try {
        const runtime = await import("@splinetool/runtime");
        if (disposed || !canvasRef.current) return;
        const application = new runtime.Application(canvasRef.current);
        app = application as unknown as { dispose?: () => void };

        /* A dead scene URL does not reject — the runtime's load() simply
           never settles, which left a permanent "LOADING" under a hero that
           was never going to arrive. The race is the guard: past the
           deadline the drawing is the answer. */
        await Promise.race([
          application.load(sceneUrl),
          new Promise((_, reject) =>
            window.setTimeout(() => reject(new Error("scene load timed out")), 8000),
          ),
        ]);
        if (disposed) return;
        setPhase("live");
      } catch (error) {
        /* A hero that fails silently is correct here: the drawing is
           already on screen and the reader loses nothing. The console line
           is for whoever is debugging it. */
        console.warn("[observatory] 3D scene unavailable", error);
        try {
          app?.dispose?.();
        } catch {
          /* nothing to clean up */
        }
        app = null;
        if (!disposed) setPhase("static");
      }
    };

    /* Only once the hero is actually on screen. On a page opened at the
       top that is immediate; on a deep link it never costs anything. */
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void start();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(frame);

    return () => {
      disposed = true;
      observer.disconnect();
      try {
        app?.dispose?.();
      } catch {
        /* the runtime is going away with the page anyway */
      }
    };
  }, [sceneUrl]);

  return (
    <div
      ref={frameRef}
      /* A fixed square both states fill. The 3D canvas is positioned over
         the drawing rather than replacing it, so the swap cannot reflow
         anything and cannot flash an empty box. */
      className={`relative aspect-square w-full ${className}`}
      aria-hidden="true"
    >
      <ObservatoryFallback
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
          phase === "live" ? "opacity-0" : "opacity-100"
        }`}
      />

      {sceneUrl && (
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
            phase === "live" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {phase === "loading" && (
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.18em] text-white/35">
          LOADING
        </span>
      )}
    </div>
  );
}
