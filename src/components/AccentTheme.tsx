import { tint } from "@/lib/company-identity";

/**
 * The one colour that changes per page.
 *
 * Every page can set an accent, and the whole interface follows: the pools
 * of light in the fixed background, the tint on hovered panels, the chips,
 * the active link in the nav, the selection highlight and the scrollbar all
 * read `--accent` rather than receiving it as a prop. A company page
 * therefore takes on that company's colour without a single component
 * inside it knowing which company is on screen.
 *
 * It writes a `:root` rule rather than wrapping the page in a div, because
 * the background layers live in the root layout — outside any page's
 * subtree — and a wrapper could not reach them. The rule is emitted in the
 * page's own output, so navigating to a different page replaces it.
 *
 * What does NOT take the accent is deliberate. Figures stay in the neutral
 * ink colour, and green and red keep meaning price direction and nothing
 * else. Tinting a number to match a brand would make the same value look
 * different on two company pages, which is exactly the decorative colour
 * this project forbids.
 */

/** Hex or hsl() only. The accent comes from our own palette, but this value
 *  is interpolated into a stylesheet — validating it here means a future
 *  caller cannot turn a data field into CSS. */
const SAFE_COLOUR = /^(#[0-9a-f]{3,8}|hsl\([0-9a-z%.,\s/]+\))$/i;

export function AccentTheme({ accent }: { accent: string }) {
  if (!SAFE_COLOUR.test(accent.trim())) return null;

  const css = `:root{--accent:${accent};--accent-soft:${tint(accent, 0.14)};--accent-line:${tint(accent, 0.3)}}`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
