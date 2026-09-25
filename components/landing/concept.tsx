import { Check, MoveRight } from "lucide-react";
import { CONCEPT, BRAND } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader } from "@/components/landing/section";
import { cn } from "cn";

export function ConceptSection() {
  return (
    <Section ariaLabel="La marketplace inversée">
      <SectionHeader eyebrow={CONCEPT.eyebrow} title={CONCEPT.title} lead={CONCEPT.lead} />

      <div className="relative mt-16 grid items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
        <Reveal>
          <div className="card h-full bg-[#1E1E1E] p-7 sm:p-9">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Marketplace classique
            </h3>
            <p className="mt-2 text-lg font-semibold tracking-tight">
              Vous courez après les clients
            </p>
            <FlowSteps steps={CONCEPT.classic} tone="muted" />
          </div>
        </Reveal>

        <Reveal delay={2} className="hidden items-center lg:flex">
          <MoveRight className="size-7 text-[#E86A2C]" aria-hidden="true" />
        </Reveal>

        <Reveal delay={1} className="relative">
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-[#E86A2C]/50 via-[#E86A2C]/15 to-transparent" aria-hidden="true" />
          <div className="card-glass relative h-full p-7 sm:p-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#E86A2C]">
                {BRAND}
              </h3>
              <span className="badge badge-warning">Nouveau</span>
            </div>
            <p className="mt-2 text-lg font-semibold tracking-tight">
              Les développeurs viennent à vous
            </p>
            <FlowSteps steps={CONCEPT.inverted} tone="accent" />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function FlowSteps({
  steps,
  tone,
}: {
  steps: readonly { label: string; highlight?: boolean }[];
  tone: "muted" | "accent";
}) {
  return (
    <ol className="mt-8 space-y-1">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex items-start gap-4 pb-1">
          {index < steps.length - 1 && (
            <span
              className={cn(
                "absolute left-[11px] top-8 h-[calc(100%-1.25rem)] w-px",
                tone === "accent"
                  ? "bg-gradient-to-b from-[#E86A2C]/50 to-transparent"
                  : "bg-[#3A3A3A]"
              )}
              aria-hidden="true"
            />
          )}
          <span
            className={cn(
              "relative z-10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
              tone === "accent"
                ? "border-[#E86A2C] bg-[#2A1A10] text-[#E86A2C]"
                : "border-[#2A2A2A] bg-[#141414] text-muted-foreground"
            )}
            aria-hidden="true"
          >
            {tone === "accent" && index === steps.length - 1 ? (
              <Check className="size-3" />
            ) : (
              index + 1
            )}
          </span>
          <span
            className={cn(
              "text-[15px] font-medium",
              tone === "accent" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}