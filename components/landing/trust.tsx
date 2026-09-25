import { ShieldCheck } from "lucide-react";
import { TRUST_FEATURES } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader } from "@/components/landing/section";
import { cn } from "cn";

export function TrustSection() {
  return (
    <Section className="border-y border-[#2A2A2A] bg-[#0F0F0F]" ariaLabel="Confiance">
      <SectionHeader
        eyebrow="Confiance"
        title="Un nouveau marché, construit avec confiance."
        lead="Nous avançons pas à pas. Chaque fonctionnalité est annoncée uniquement lorsqu’elle est réellement disponible."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TRUST_FEATURES.map((feature, index) => (
          <Reveal key={feature.title} delay={(index % 3) as 0 | 1 | 2}>
            <div className="card card-interactive h-full p-7">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#2A1A10]">
                  <ShieldCheck className="size-5 text-[#E86A2C]" aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    feature.status === "Disponible" ? "badge badge-success" : "badge badge-warning"
                  )}
                >
                  {feature.status}
                </span>
              </div>
              <h3 className="mt-5 text-base font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.text}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}