import { TESTIMONIALS } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader } from "@/components/landing/section";

export function TestimonialsSection() {
  return (
    <Section ariaLabel="Témoignages">
      <SectionHeader
        eyebrow="Ils nous font confiance"
        title="Ce que nos utilisateurs diront bientôt"
        lead="Des témoignages d’utilisateurs réels seront publiés ici dès le lancement. En attendant, voici des exemples."
      />

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((t, index) => (
          <Reveal key={t.name} delay={(index % 3) as 0 | 1 | 2}>
            <figure className="card card-interactive h-full p-7">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-full bg-[#2A1A10] text-sm font-bold text-primary">
                  {t.initials}
                </span>
                <span className="badge badge-muted">Exemple</span>
              </div>
              <blockquote className="mt-5 flex-1 text-[15px] leading-relaxed">
                {t.quote}
              </blockquote>
              <figcaption className="mt-6 border-t border-hairline pt-4">
                <p className="text-sm font-semibold tracking-tight">{t.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.activity}</p>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}