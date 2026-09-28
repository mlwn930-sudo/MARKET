/** A teaching model, deliberately independent of quote feeds and company guidance. */
export function launchScenario(unitsMillions: number, realizedPrice: number, platformPercent: number) {
  const gross = unitsMillions * 1_000_000 * realizedPrice;
  const platform = gross * platformPercent / 100;
  return {gross, platform, publisher:gross - platform};
}
