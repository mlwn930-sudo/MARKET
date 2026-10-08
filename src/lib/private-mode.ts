/**
 * The owner's private build, and the one switch that turns it off.
 *
 * This project has a rule that outranks almost everything in it: analysis
 * yes, rating no. The site describes what the reports and the price have
 * already done and hands the reader the argument; it does not score a
 * company, does not rank it, and does not tell anybody what to do. That
 * rule exists because a site that says "expensive, avoid" is asking to be
 * trusted instead of read.
 *
 * The owner is, for now, the only person using this. He asked for the
 * opposite: a stated direction, a horizon, scenarios and a view — and
 * said he would turn it off before opening the site to anyone else.
 *
 * SO IT IS A FLAG AND NOT AN EDIT. The alternative was to rewrite the
 * analysis layer to have opinions and rewrite it back later, which means
 * the public version depends on somebody remembering a conversation
 * months from now. One environment variable is a thing that can be
 * checked, tested, and left off.
 *
 * DEFAULT OFF, AND DELIBERATELY SO. A missing variable means public
 * behaviour. If this ever ships somewhere nobody configured, it ships as
 * research rather than as advice — the failure mode points the safe way
 * rather than needing a deployment to be remembered correctly.
 *
 * NEXT_PUBLIC_ because the panels that render a stance are client
 * components and the server prompts need the same answer. One variable,
 * read the same way on both sides, so the page and the model can never
 * disagree about which site this is.
 */
export function isPrivateBuild(): boolean {
  return process.env.NEXT_PUBLIC_PRIVATE_MODE === "1";
}

/**
 * Printed wherever a stance is shown.
 *
 * Not a legal formula and not an apology. It says which build the reader
 * is looking at, because the whole point of the flag is that the same
 * page says different things in the two modes, and a reader who forgets
 * which one is on has no way to tell from the figures.
 */
export const PRIVATE_NOTE =
  "מצב פרטי: העמוד הזה מציג עמדה ותרחישים, ולא רק מדידות. " +
  "כל מספר כאן נספר מההיסטוריה של הנייר עצמו, וכל עמדה מגיעה עם מה שיפריך אותה. " +
  "זו אינה המלצת השקעות ואינה ייעוץ — ההחלטה היא של הקורא.";
