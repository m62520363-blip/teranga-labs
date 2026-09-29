import { Search } from "lucide-react";
import { PROBLEM } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader, Eyebrow } from "@/components/landing/section";

export function ProblemSection() {
  return (
    <Section className="border-y border-hairline bg-surface" ariaLabel="Le problème des marketplaces classiques">
      <div className="mx-auto max-w-3xl text-center">
        <SectionHeader eyebrow={PROBLEM.eyebrow} title={PROBLEM.title} lead={PROBLEM.lead} />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEM.points.map((point, index) => (
            <Reveal key={point.stat} delay={(index % 4) as 0 | 1 | 2 | 3}>
              <div className="card card-interactive h-full p-6 text-left">
                <Search className="size-4 text-muted-foreground/40" aria-hidden="true" />
                <p className="mt-5 font-display text-3xl font-bold tracking-tight">
                  {point.stat}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {point.label}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={2} className="mt-14">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
            <Eyebrow>Puis imaginez l’inverse…</Eyebrow>
            <p className="text-lg font-medium tracking-tight">{PROBLEM.transition}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {PROBLEM.transitionSub}
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}