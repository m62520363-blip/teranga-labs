import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ShieldCheck } from "lucide-react";
import { Scene3D } from "@/components/landing/scene-3d";
import { HeroLaptop } from "@/components/landing/hero-laptop";
import { RotatingWords } from "@/components/landing/rotating-words";

export function Hero() {
  const t = useTranslations("Landing.hero");
  return (
    <section id="accueil" className="relative scroll-mt-24 overflow-hidden">
      {/* Halo de marque : radial primaire en haut, respiration lente */}
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--primary) 18%, transparent), transparent)",
        }}
      />

      {/* Composition façon Montaaj : badge, titre, texte, boutons centrés,
          puis l'ordinateur posé en dessous (perspective 800px). */}
      <div className="relative flex flex-col items-center px-5 pt-24 pb-16 text-center sm:px-6 lg:mt-[6vh] lg:pt-[8rem] lg:pb-24">
        <span
          className="animate-rise mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-sm text-foreground"
          style={{ "--rise-delay": "1100ms" } as React.CSSProperties}
        >
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          {t("badge")}
        </span>

        <HeroTitle className="animate-rise" delay="1250ms" />

        <p
          className="animate-rise mt-4 font-headings text-lg font-bold tracking-tight text-primary sm:text-xl"
          style={{ "--rise-delay": "1300ms" } as React.CSSProperties}
        >
          {t("slogan")}
        </p>

        <p
          className="animate-rise mt-4 max-w-xl text-base text-muted-foreground sm:text-lg sm:leading-relaxed"
          style={{ "--rise-delay": "1350ms" } as React.CSSProperties}
        >
          {t("subtitle")}
        </p>

        <div
          className="animate-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ "--rise-delay": "1550ms" } as React.CSSProperties}
        >
          <Link
            href="/dev"
            className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {t("ctaPrimary")}
          </Link>
          <Link
            href="/poster"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/60 px-5 py-2.5 text-sm text-foreground transition-colors outline-none hover:border-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {t("ctaSecondary")}
          </Link>
        </div>

        <p
          className="animate-rise mt-4 text-xs text-muted-foreground"
          style={{ "--rise-delay": "1650ms" } as React.CSSProperties}
        >
          {t("ctaNote")}
        </p>

        {/* Showcase : ordinateur + scène 3D de fond (profondeur) */}
        <div className="relative mx-auto mt-14 w-full max-w-md sm:max-w-lg lg:mt-16 lg:w-[32rem] lg:max-w-none">
          <Scene3D
            variant="marketplace"
            className="pointer-events-none absolute -inset-x-16 -bottom-10 -top-8 -z-10 opacity-40"
          />
          <div className="pointer-events-none absolute -inset-x-10 top-16 -z-10 h-64 rounded-full bg-[radial-gradient(closest-side,rgba(57,255,136,0.16),transparent)]" />
          <HeroLaptop />
        </div>
      </div>

      {/* Voile de bas de section : fondu vers le fond */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-40 bg-gradient-to-b from-transparent to-background sm:h-56"
      />
    </section>
  );
}

function HeroTitle({ className, delay }: { className?: string; delay: string }) {
  const t = useTranslations("Landing.hero");
  const title = t("title");
  const rotating = t.raw("rotating") as string[];
  // Le titre se scinde sur le dernier espace : « … web, paie » / « …, pay ».
  const splitAt = title.lastIndexOf(" ");
  const head = splitAt > 0 ? title.slice(0, splitAt) : title;
  const tail = splitAt > 0 ? title.slice(splitAt + 1) : "";
  return (
    <h1
      className={
        "flex flex-col items-center text-balance font-headings text-4xl leading-[1.05] font-black tracking-tight sm:text-4xl md:text-5xl lg:text-6xl " +
        (className ?? "")
      }
      style={{ "--rise-delay": delay } as React.CSSProperties}
    >
      <span className="sr-only">
        {title} {rotating[0]}
      </span>
      <span aria-hidden="true" className="text-center">
        {head}
      </span>
      <span
        aria-hidden="true"
        className="flex flex-wrap items-baseline justify-center gap-x-3"
      >
        <span>{tail}</span>
        <RotatingWords words={rotating} className="align-baseline" />
      </span>
    </h1>
  );
}
