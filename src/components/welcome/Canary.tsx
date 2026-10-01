/**
 * The house bird. Drawn here, owned here.
 *
 * The reference was a photograph of a Warner Bros character in a Louis
 * Vuitton hat, sitting on banknotes. Three separate people's property in
 * one picture, on the first screen anyone would see — which is the exact
 * opposite of the brief, since the same request asked for a site nobody
 * could bring a claim against. So this is an original bird, built from
 * circles and a few paths, carrying none of that.
 *
 * A canary and not a duck, and the reason is the subject: a canary is the
 * bird that tells you the air has changed before you can feel it. On a
 * market research site that is the whole promise, and it means the mascot
 * is saying something rather than just being yellow.
 *
 * Everything is flat vector in the site's warm palette. No gradients on
 * the body — a shape that reads at 40px on a phone tab and at 400px on the
 * welcome screen has to survive on silhouette, and gradients at the small
 * size turn into mud.
 */
export function Canary({
  size = 280,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="הקנרית של MARKET"
    >
      <defs>
        <radialGradient id="canary-glow" cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor="#F5CB5C" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#F5CB5C" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The light it sits in, not light coming off it. */}
      <circle cx="100" cy="96" r="92" fill="url(#canary-glow)" />

      {/* No perch: the bird stands on the money now, and a brass bar
          crossing the pile read as a bar floating in front of it. */}
      {/* Tail, tucked under the body rather than beside it. Drawn as a
          detached wedge first, it read as a loose shape on the left — a
          tail has to look attached or it looks like a mistake. */}
      <path d="M74 126 L30 146 L36 112 L72 104 Z" fill="#D99D24" />

      {/* Body. */}
      <ellipse cx="104" cy="112" rx="46" ry="44" fill="#F3C53F" />
      {/* Wing, one tone down so the silhouette still reads flat, and
          placed well inside the body outline so it reads as a fold rather
          than as a second shape stuck on the side. */}
      <path
        d="M88 100 q32 2 40 26 q-24 11 -40 -3 q-7 -11 0 -23 Z"
        fill="#D99D24"
      />

      {/* Head. */}
      <circle cx="116" cy="70" r="34" fill="#F5CB5C" />

      {/* The cap. Knitted, folded brim — the one borrowed idea, and an idea
          is not a design: no monogram, no mark, nobody's. */}
      <path
        d="M86 56 q4 -34 32 -36 q30 -2 34 32 q-32 -10 -66 4 Z"
        fill="#D4622A"
      />
      <rect x="84" y="50" width="70" height="13" rx="6.5" fill="#E0702F" />
      <circle cx="152" cy="22" r="7" fill="#E0702F" />

      {/* Face. Two dots and a beak — the more a mascot's face is drawn the
          worse it ages. */}
      <circle cx="104" cy="74" r="6.5" fill="#1A1410" />
      <circle cx="131" cy="74" r="6.5" fill="#1A1410" />
      <circle cx="106" cy="71.5" r="2.2" fill="#fff" />
      <circle cx="133" cy="71.5" r="2.2" fill="#fff" />
      <path d="M118 86 L140 92 L118 99 Z" fill="#D4622A" />

      {/* Feet. */}
      <path
        d="M96 156 l0 12 M96 168 l-8 6 M96 168 l8 6 M120 156 l0 12 M120 168 l-8 6 M120 168 l8 6"
        stroke="#D4622A"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
