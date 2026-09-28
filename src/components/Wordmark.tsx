/** A typographic mark shared by the shell, footer and editorial pages. */
export function Wordmark({ tone = "ink", size = "md", showName = true }: {
  tone?: "ink" | "light"; size?: "sm" | "md"; showName?: boolean;
}) {
  return <span className="market-logo" style={{ color: tone === "light" ? "#eef4fc" : "var(--color-ink)" }}>
    <span className="market-logo-mark" aria-hidden="true"><i /><i /><i /></span>
    {showName && <span className="market-logo-name" style={size === "sm" ? { fontSize: 18 } : undefined}>MARKET</span>}
  </span>;
}
