import { BENEFITS } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader } from "@/components/landing/section";

const POINTS = ["Moins de recherche", "Offres adaptées", "Marché dynamique", "100% Sénégal"];

export function BenefitsSection() {
  return (
    <Section ariaLabel="Pourquoi TERANGA LABS">
      <SectionHeader eyebrow={BENEFITS.eyebrow} title={BENEFITS.title} />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.cards.map((card, index) => (
          <Reveal key={card.title} delay={(index % 4) as 0 | 1 | 2 | 3}>
            <div className="card card-interactive h-full p-7">
              <p className="font-display text-sm font-bold tracking-[0.2em] text-primary">
                0{index + 1}
              </p>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {card.text}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={2} className="mt-12">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {POINTS.map((point) => (
            <span key={point} className="chip">
              {point}
            </span>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}