/**
 * The header this project introduces itself with.
 *
 * It was the same sentence copied into six files, each carrying the
 * owner's email address as a literal — in a public repository, where
 * anyone who clones it gets a working address. The contact is good
 * manners toward Yahoo and TASE and it is not a requirement of theirs;
 * it belongs in configuration, like every other personal detail.
 *
 * NOT THE SEC HEADER. `sec.ts` reads `SEC_USER_AGENT` separately and
 * must keep doing so: the SEC genuinely requires a name and an email in
 * the format it specifies, refuses the request otherwise, and blocks on
 * repetition. That one is a protocol, this one is politeness.
 *
 * Without `CONTACT_EMAIL` the header still identifies the client and
 * still says what it is for. An unset variable costs a line of contact
 * detail, not access.
 */
export function userAgent(purpose = "personal research"): string {
  const contact = process.env.CONTACT_EMAIL?.trim();
  return contact
    ? `MarketIntel/1.0 (${purpose}; ${contact})`
    : `MarketIntel/1.0 (${purpose})`;
}

/**
 * The browser-shaped header Yahoo requires.
 *
 * Separate and deliberately dishonest-looking, because Yahoo refuses a
 * default or a bot-shaped agent outright. Kept here beside the real one
 * so the difference is visible rather than discovered: this is the only
 * place in the project that pretends to be something it is not, and it
 * carries no contact detail because a browser would not.
 */
export const BROWSER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36";
