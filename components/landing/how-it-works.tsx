import { CheckCircle2, Inbox, PenLine } from "lucide-react";
import { STEPS } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader } from "@/components/landing/section";

const ICONS = {
  pen: PenLine,
  inbox: Inbox,
  check: CheckCircle2,
} as const;

export function HowItWorks() {
  return (
    <Section id="comment-ca-marche" className="bg-card" ariaLabel="Comment ça marche">
      <SectionHeader
        eyebrow="Comment ça marche"
        title="Simple. Rapide. Direct."
        lead="Trois étapes suffisent pour lancer votre recherche — ou trouver vos prochains clients."
      />

      <div className="relative mt-16 grid gap-8 md:grid-cols-3 md:gap-6">
        <div
          className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-10 hidden h-px bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 md:block"
          aria-hidden="true"
        />
        {STEPS.map((step, index) => {
          const Icon = ICONS[step.icon];
          return (
            <Reveal key={step.num} delay={(index % 3) as 0 | 1 | 2}>
              <div className="card card-interactive relative h-full p-7 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft">
                  <Icon className="size-6 text-primary" aria-hidden="true" />
                </div>
                <p className="mt-6 font-display text-sm font-bold tracking-[0.2em] text-primary">
                  {step.num}
                </p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}