import { ShieldCheck } from "lucide-react";
import { TRUST_FEATURES } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader } from "@/components/landing/section";
import { cn } from "cn";

export function TrustSection() {
  return (
    <Section className="border-y border-hairline bg-surface" ariaLabel="Confiance">
      <SectionHeader
        eyebrow="Confiance"
        title="Un nouveau marché, construit avec confiance."
        lead="Nous avançons pas à pas. Chaque fonctionnalité est annoncée uniquement lorsqu’elle est réellement disponible."
      />

      <Reveal className="mt-12">
        {/* Carte abstraite des pays et villes réellement desservis (SVG local,
            déjà optimisé : next/image n'apporterait rien sur du vectoriel). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illustrations/afrique-ouest.svg"
          alt="Carte stylisée de l’Afrique de l’Ouest francophone : Dakar, Abidjan, Bamako, Nouakchott et les régions couvertes par TERANGA LABS"
          width={480}
          height={360}
          loading="lazy"
          className="mx-auto w-full max-w-xl rounded-2xl border border-hairline"
        />
      </Reveal>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TRUST_FEATURES.map((feature, index) => (
          <Reveal key={feature.title} delay={(index % 3) as 0 | 1 | 2}>
            <div className="card card-interactive h-full p-7">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft">
                  <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
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