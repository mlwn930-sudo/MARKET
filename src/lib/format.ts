/** Display formatting. Every number that reaches the screen goes through here. */

const price = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtPrice(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return price.format(n);
}

export function fmtPercent(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

export function fmtChange(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${price.format(Math.abs(n))}`;
}

/** Large figures in compact form: 1_240_000_000 -> "1.24B". */
export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

/** Direction class. Returns muted for flat or unknown — never a random colour. */
export function directionClass(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) {
    return "text-ink-muted";
  }
  return n > 0 ? "text-up" : "text-down";
}

/** Renders a computed metric according to its unit. Missing stays missing. */
export function fmtMetric(
  value: number | null,
  unit: "x" | "%" | "$" | "",
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  switch (unit) {
    case "x":
      return `${value.toFixed(value >= 100 ? 0 : 1)}x`;
    case "%":
      return `${value.toFixed(1)}%`;
    case "$":
      return `$${fmtCompact(value)}`;
    default:
      return value.toFixed(2);
  }
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

/** Relative time in Hebrew: "לפני 12 דקות". */
export function fmtRelative(d: Date): string {
  const minutes = Math.round((Date.now() - d.getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return "";
  if (minutes < 1) return "הרגע";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.round(hours / 24);
  return `לפני ${days} ימים`;
}
