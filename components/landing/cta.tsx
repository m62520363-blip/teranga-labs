import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { CTA, BRAND } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Scene3D } from "@/components/landing/scene-3d";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden tl-dark py-24 md:py-32" aria-label="Appel à l’action">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(46rem 26rem at 50% -20%, rgba(232,106,44,0.28), transparent 65%), radial-gradient(30rem 20rem at 92% 110%, rgba(232,106,44,0.16), transparent 60%)",
        }}
      />
      <div
        className="bg-grid pointer-events-none absolute inset-0 opacity-40"
        aria-hidden="true"
        style={{
          maskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, black 25%, transparent 100%)",
        }}
      />
      {/* Deux scènes 3D en lisière : composition forte sans jamais gêner
          le texte central ni les boutons (pointer-events-none, xl+). */}
      <Scene3D
        variant="team"
        className="pointer-events-none absolute -left-20 bottom-6 hidden opacity-30 xl:block"
      />
      <Scene3D
        variant="marketplace"
        className="pointer-events-none absolute -right-20 top-6 hidden opacity-30 xl:block"
      />

      <Reveal className="container-tl relative">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
            {CTA.titleA}{" "}
            <span className="text-accent-gradient">{CTA.titleB}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            {CTA.text}
          </p>

          <div className="mt-11 flex flex-wrap items-center justify-center gap-3">
            <Link href={CTA.ctaPrimary.href} className="btn btn-primary btn-lg">
              {CTA.ctaPrimary.label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href={CTA.ctaSecondary.href} className="btn btn-invert btn-lg">
              <Store className="size-4" aria-hidden="true" />
              {CTA.ctaSecondary.label}
            </Link>
          </div>

          <p className="mt-8 text-sm text-white/50">© {BRAND} — Afrique de l&apos;Ouest, 2026</p>
        </div>
      </Reveal>
    </section>
  );
}