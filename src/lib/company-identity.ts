/**
 * A colour for every company page.
 *
 * Well-known companies get the colour people already associate with them,
 * which makes a page recognisable before the name is read. Everything else
 * falls back to its sector colour, and anything outside the universe gets a
 * colour derived from the ticker itself — deterministic, so the same company
 * always looks the same.
 *
 * Colour only. No logos, no wordmarks: those are trademarks, and a research
 * site has no business reproducing them.
 */

import { SECTOR_LABELS, sectorOf, type SectorKey } from "./universe";

const BRAND: Record<string, string> = {
  NVDA: "#76b900",
  AMD: "#ed1c24",
  INTC: "#0071c5",
  TSM: "#c4122e",
  MU: "#1a3a8f",
  AVGO: "#cc0000",
  QCOM: "#3253dc",
  TXN: "#cc0000",
  ASML: "#0b5eb0",

  AAPL: "#a2aaad",
  MSFT: "#00a4ef",
  GOOGL: "#4285f4",
  AMZN: "#ff9900",
  META: "#0866ff",
  NFLX: "#e50914",
  TSLA: "#e82127",
  ORCL: "#f80000",
  CRM: "#00a1e0",
  ADBE: "#fa0f00",
  NOW: "#62d84e",
  INTU: "#365ebf",
  BKNG: "#003580",
  PLTR: "#26b6e3",

  XOM: "#e01e26",
  CVX: "#0054a0",
  COP: "#e8112d",
  SLB: "#00a1df",
  EOG: "#c8102e",

  NEE: "#4a9c2d",
  DUK: "#00853f",
  SO: "#0072ce",
  CEG: "#00a0df",

  JPM: "#5c2d0c",
  BAC: "#e31837",
  GS: "#6b8ba4",
  MS: "#004b87",
  WFC: "#d71e2b",

  WMT: "#0071ce",
  COST: "#e31837",
  HD: "#f96302",
  NKE: "#f5f5f5",
  MCD: "#ffc72c",
  SBUX: "#00704a",
  TGT: "#cc0000",

  LMT: "#1b3f6b",
  RTX: "#e4002b",
  BA: "#0039a6",
  NOC: "#0060a9",
  GD: "#00447c",

  LLY: "#e1261c",
  JNJ: "#d51900",
  MRK: "#00857c",
  PFE: "#0093d0",
  ABBV: "#071d49",
  UNH: "#002677",

  CAT: "#ffcd11",
  GE: "#0a7cba",
  HON: "#ee3124",
  UNP: "#ffd400",

  T: "#00a8e0",
  VZ: "#ee0000",
  TMUS: "#e20074",

  TTWO: "#fcaf17",
};

const SECTOR_ACCENT: Record<SectorKey, string> = {
  semis: "#1d9e75",
  software: "#7f77dd",
  internet: "#378add",
  healthcare: "#5dcaa5",
  financials: "#185fa5",
  energy: "#d85a30",
  consumer: "#97c459",
  industrials: "#888780",
  telecom: "#d4537e",
};

/** Deterministic hue for a company we have no other colour for. Same ticker
 *  always produces the same colour, so a page does not change appearance
 *  between visits. */
function hashColour(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) >>> 0;
  }
  // Mid saturation and lightness keep it legible on the dark canvas.
  return `hsl(${hash % 360} 55% 58%)`;
}

export type CompanyIdentity = {
  accent: string;
  sectorLabel: string | null;
  /** True when the colour is the company's own rather than a fallback. */
  branded: boolean;
};

export function identityFor(ticker: string): CompanyIdentity {
  const symbol = ticker.toUpperCase();
  const sector = sectorOf(symbol);

  const accent =
    BRAND[symbol] ??
    (sector ? SECTOR_ACCENT[sector] : undefined) ??
    hashColour(symbol);

  return {
    accent,
    sectorLabel: sector ? SECTOR_LABELS[sector] : null,
    branded: Boolean(BRAND[symbol]),
  };
}

/** A translucent version of the accent, for tinted surfaces. */
export function tint(accent: string, alpha: number): string {
  if (accent.startsWith("hsl")) {
    return accent.replace(/\)$/, ` / ${alpha})`);
  }
  const hex = accent.replace("#", "");
  const value = parseInt(
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex,
    16,
  );
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
