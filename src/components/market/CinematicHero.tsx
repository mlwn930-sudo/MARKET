import Image from "next/image";
import type { ReactNode } from "react";

export function CinematicHero({ image, eyebrow, title, description, actions, aside, footer, variant = "market" }: {
  image: string; eyebrow: ReactNode; title: ReactNode; description: string;
  actions: ReactNode; aside?: ReactNode; footer?: ReactNode; variant?: "market" | "story";
}) {
  return <header className={"cinematic-hero on-dark cinematic-hero--" + variant}>
    <div className="cinematic-media" aria-hidden="true">
      <Image src={image} alt="" fill priority sizes="100vw" quality={85} className="object-cover" />
    </div>
    <div className="cinematic-shade" aria-hidden="true" />
    <div className="cinematic-inner">
      <div className="cinematic-topline">{eyebrow}<span className="micro-label" dir="ltr">MARKET / INTELLIGENCE</span></div>
      <div className="cinematic-composition">
        <div className="cinematic-copy">
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="cinematic-actions">{actions}</div>
        </div>
        {aside && <div className="cinematic-aside">{aside}</div>}
      </div>
      {footer && <div className="cinematic-footer">{footer}</div>}
    </div>
  </header>;
}
