import * as React from "react";
import Link from "next/link";
import { Check, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { HERO, HERO_DEMO } from "@/components/landing/content";
import { TOKEN_LABEL, TOKEN_RULE } from "@/lib/formatting";
import { Scene3D } from "@/components/landing/scene-3d";
import { HeroOrbit } from "@/components/landing/hero-orbit";
import { RotatingWords } from "@/components/landing/rotating-words";

export function Hero({
  realBrief,
}: {
  realBrief?: {
    title: string;
    budget: string;
    location: string;
  } | null;
}) {
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

      {/* Variante mobile : colonne centrée pleine hauteur */}
      <div className="flex min-h-[100svh] flex-col items-center justify-center px-5 pt-24 pb-16 text-center sm:px-6 lg:hidden">
        <span
          className="animate-rise mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-sm text-foreground"
          style={{ "--rise-delay": "1100ms" } as React.CSSProperties}
        >
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          {HERO.badge}
        </span>

        <HeroTitle className="animate-rise" delay="1250ms" />

        <p
          className="animate-rise mt-5 max-w-sm text-base text-muted-foreground"
          style={{ "--rise-delay": "1350ms" } as React.CSSProperties}
        >
          {HERO.subtitle}
        </p>

        <div
          className="animate-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ "--rise-delay": "1550ms" } as React.CSSProperties}
        >
          <Link
            href={HERO.ctaPrimary.href}
            className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {HERO.ctaPrimary.label}
          </Link>
          <Link
            href={HERO.ctaSecondary.href}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/60 px-5 py-2.5 text-sm text-foreground transition-colors outline-none hover:border-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {HERO.ctaSecondary.label}
          </Link>
        </div>
      </div>

      {/* Variante desktop : texte + showcase du brief réel */}
      <div className="container-tl relative grid items-center gap-16 pb-24 pt-32 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:min-h-[100svh]">
        <div className="max-w-2xl">
          <span
            className="animate-rise inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-sm text-foreground"
            style={{ "--rise-delay": "1100ms" } as React.CSSProperties}
          >
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {HERO.badge}
          </span>

          <HeroTitle className="animate-rise mt-5" delay="1250ms" />

          <p
            className="animate-rise mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground"
            style={{ "--rise-delay": "1350ms" } as React.CSSProperties}
          >
            {HERO.subtitle}
          </p>

          <div
            className="animate-rise mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            style={{ "--rise-delay": "1550ms" } as React.CSSProperties}
          >
            <Link
              href={HERO.ctaPrimary.href}
              className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {HERO.ctaPrimary.label}
            </Link>
            <Link
              href={HERO.ctaSecondary.href}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/60 px-5 py-2.5 text-sm text-foreground transition-colors outline-none hover:border-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {HERO.ctaSecondary.label}
            </Link>
          </div>
        </div>

        <HeroVisual realBrief={realBrief} />
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
  return (
    <h1
      className={
        "flex flex-col items-center text-balance font-headings text-4xl leading-[1.05] font-black tracking-tight sm:text-4xl md:text-5xl lg:text-6xl " +
        (className ?? "")
      }
      style={{ "--rise-delay": delay } as React.CSSProperties}
    >
      <span className="sr-only">
        Trouve ton développeur web, paie {HERO.rotating[0]}
      </span>
      <span aria-hidden="true" className="lg:text-left text-center">
        Trouve ton développeur web,
      </span>
      <span
        aria-hidden="true"
        className="flex flex-wrap items-baseline justify-center gap-x-3 lg:justify-start"
      >
        <span>paie</span>
        <RotatingWords words={HERO.rotating} className="align-baseline" />
      </span>
    </h1>
  );
}

function HeroVisual({
  realBrief,
}: {
  realBrief?: { title: string; budget: string; location: string } | null;
}) {
  return (
    <div
      className="animate-rise relative mx-auto w-full max-w-md"
      style={{ "--rise-delay": "1400ms" } as React.CSSProperties}
      aria-hidden="true"
    >
      {/* Scène 3D de fond : profondeur réelle (translateZ) et objets flottants,
          parallax désactivé ici pour laisser la carte du brief cliquable. */}
      <Scene3D
        variant="marketplace"
        className="pointer-events-none absolute -inset-x-16 -bottom-24 -top-14 -z-10 opacity-50"
      />
      {/* Orbite décorative : mini tableau de bord, brief flottant, duo
          client/développeur, badge vérifié — parallax léger au pointeur. */}
      <HeroOrbit />
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(232,106,44,0.16),transparent)]" />

      <div className="rounded-card border border-hairline bg-card p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {HERO_DEMO.label}
          </span>
          <span className="badge badge-muted">
            <Check className="size-3" aria-hidden="true" />
            Devs sérieux uniquement
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-hairline bg-gradient-to-br from-muted to-card p-5">
          {realBrief ? (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-success">
                Brief réel en ligne
              </p>
              <p className="text-[15px] font-semibold leading-snug tracking-tight">
                {realBrief.title}
              </p>
              <div className="mt-4 space-y-2.5">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="size-4 text-primary" aria-hidden="true" />
                  {realBrief.budget}
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="size-4 text-primary" aria-hidden="true" />
                  {realBrief.location}
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Exemple — aucun brief en ligne
              </p>
              <p className="text-[15px] font-semibold leading-snug tracking-tight">
                {HERO_DEMO.request.title}
              </p>
              <div className="mt-4 space-y-2.5">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="size-4 text-primary" aria-hidden="true" />
                  {HERO_DEMO.request.budget}
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="size-4 text-primary" aria-hidden="true" />
                  {HERO_DEMO.request.location}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="relative mt-5 space-y-3">
          {HERO_DEMO.flow.map((item) => (
            <div
              key={item.step}
              className="tl-drift relative flex items-center justify-between gap-3 rounded-xl border border-hairline bg-card px-4 py-3 shadow-sm"
              style={{ animationDelay: `${item.delay}s`, animationDuration: "5s" }}
            >
              <span className="text-sm font-semibold tracking-tight text-foreground">
                {item.step}
              </span>
              <span className="text-right text-xs text-muted-foreground">{item.detail}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="tl-float absolute -right-4 -top-5 rounded-full border border-hairline bg-card px-4 py-2.5 text-xs font-semibold shadow-lg shadow-black/5">
        Brief publié · {TOKEN_LABEL}
      </div>
      <div
        className="tl-float absolute -bottom-5 -left-4 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-ink shadow-xl shadow-black/40"
        style={{ animationDelay: "1.4s" }}
      >
        {TOKEN_RULE} · 1 contact
      </div>
    </div>
  );
}
