import { FaqItem } from "@/components/faq-item";
import { FAQS } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader } from "@/components/landing/section";

export function FaqSection() {
  return (
    <Section id="faq" className="border-y border-[#2A2A2A] bg-[#0F0F0F]" ariaLabel="Questions fréquentes">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <SectionHeader
            align="left"
            eyebrow="FAQ"
            title="Questions fréquentes"
            lead="Tout ce qu’il faut savoir avant de publier votre premier brief, ou de débloquer votre premier contact en tant que développeur."
          />
        </Reveal>

        <Reveal delay={1}>
          <div className="card rounded-2xl bg-[#141414] p-6 sm:p-8">
            {FAQS.map((f) => (
              <FaqItem key={f.q} question={f.q} answer={f.a} />
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}