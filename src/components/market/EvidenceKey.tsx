/** Meaning stays visible even when color perception or motion differs. */
export function EvidenceKey() {
  return <aside className="evidence-key" aria-label="איך לקרוא את המידע">
    <span><i className="evidence-fact" aria-hidden="true"/>נתון ומקור</span>
    <span><i className="evidence-model" aria-hidden="true"/>פרשנות AI</span>
    <span><i className="evidence-uncertain" aria-hidden="true"/>הנחה או מידע חסר</span>
  </aside>;
}
