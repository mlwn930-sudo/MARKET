/**
 * The mark.
 *
 * Two parts that always travel together: an MI monogram carrying the
 * brand gradient, and the name set as two words in one line — MARKET in
 * ink, INTEL in blue. The split is the whole idea. It gives the lockup a
 * fixed shape at any size, and it means the blue appears exactly once in
 * the header instead of being sprayed across the navigation.
 *
 * Uppercase, tightly tracked, in the interface face rather than the
 * serif. The serif version read as a masthead for a magazine; this reads
 * as an instrument, which is what the product is.
 *
 * `tone="light"` is for the dark material — the monogram inverts to a
 * white pane with blue type, because a gradient square on navy loses its
 * edges, and the wordmark goes white with the second word in cyan, which
 * is the only blue that holds up on #0F172A.
 */
export function Wordmark({
  tone = "ink",
  size = "md",
  showName = true,
}: {
  tone?: "ink" | "light";
  size?: "sm" | "md";
  /** The monogram alone, for a tight space. */
  showName?: boolean;
}) {
  const box = size === "sm" ? 26 : 30;
  const light = tone === "light";

  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid shrink-0 place-items-center rounded-[8px] font-bold"
        style={{
          width: box,
          height: box,
          fontSize: size === "sm" ? 11 : 12.5,
          letterSpacing: "0.02em",
          background: light ? "#ffffff" : "var(--gradient-brand)",
          color: light ? "#0f172a" : "#ffffff",
          boxShadow: light
            ? "none"
            : "0 4px 12px -4px rgba(40, 85, 245, 0.55)",
        }}
      >
        MI
      </span>

      {showName && (
        <span
          className="hidden whitespace-nowrap font-bold sm:inline"
          style={{
            fontSize: size === "sm" ? 11.5 : 12.5,
            letterSpacing: "0.17em",
          }}
        >
          <span style={{ color: light ? "#ffffff" : "var(--color-ink)" }}>
            MARKET
          </span>
          <span
            style={{ color: light ? "var(--color-intelligence)" : "var(--color-brand)" }}
          >
            {" "}
            INTEL
          </span>
        </span>
      )}
    </span>
  );
}
