"use client";

import { useEffect } from "react";

/**
 * The last boundary.
 *
 * `error.tsx` catches anything thrown inside a page, but it renders
 * *within* the root layout — so it cannot help when the layout itself is
 * what failed. This one replaces the whole document, which is why it has
 * to carry its own `<html>` and `<body>`.
 *
 * It also cannot use the site's components or fonts: the stylesheet is
 * loaded by the layout that just failed. Everything here is therefore
 * inline and deliberately plain, using the palette's literal values
 * rather than its tokens — a fallback that depends on the thing it is
 * falling back from is not a fallback.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[market-intel] root error", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#060b14",
          color: "#f8fafc",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: "540px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "11px",
              letterSpacing: "0.11em",
              textTransform: "uppercase",
              color: "#f59e0b",
            }}
          >
            תקלה
          </p>

          <h1
            style={{
              margin: "16px 0 0",
              fontSize: "30px",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
            }}
          >
            האתר לא הצליח להיטען
          </h1>

          <p
            style={{
              margin: "18px 0 0",
              fontSize: "15px",
              lineHeight: 1.65,
              color: "#cbd5e1",
            }}
          >
            התקלה היא במסגרת של האתר עצמו ולא בנתונים. רשימת המעקב והתיק
            נשמרים בדפדפן שלך ולא הושפעו.
          </p>

          {error.digest && (
            <p
              style={{
                margin: "20px 0 0",
                fontSize: "11px",
                color: "#64748b",
                fontFamily: "ui-monospace, monospace",
                direction: "ltr",
                textAlign: "right",
              }}
            >
              {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "28px",
              padding: "10px 20px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              color: "#f8fafc",
              background: "linear-gradient(90deg, #0a84ff 0%, #06b6d4 100%)",
            }}
          >
            טען מחדש
          </button>
        </div>
      </body>
    </html>
  );
}
