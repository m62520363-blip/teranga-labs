import Link from "next/link";
import { ArrowRight, Check, MapPin, Wallet } from "lucide-react";
import { HERO, HERO_DEMO } from "@/components/landing/content";

export function Hero() {
  return (
    <section className="relative overflow-hidden" aria-label="Présentation">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(58rem 30rem at 88% -10%, rgba(232,106,44,0.12), transparent 62%), radial-gradient(44rem 28rem at -5% 35%, rgba(232,106,44,0.07), transparent 60%), radial-gradient(34rem 22rem at 100% 90%, rgba(232,106,44,0.06), transparent 60%)",
        }}
      />
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="glow-orb pointer-events-none absolute -top-20 right-[4%] size-80 rounded-full" aria-hidden="true" />

      <div className="container-tl relative grid items-center gap-16 pb-20 pt-24 md:pt-32 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
        <div className="max-w-2xl">
          <span className="tl-blur-in chip gap-2 bg-[#141414]/85 border-hairline backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" aria-hidden="true" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" aria-hidden="true" />
            </span>
            {HERO.badge}
          </span>

          <h1
            className="tl-blur-in mt-8 text-[42px] font-bold leading-[1.02] tracking-[-0.035em] sm:text-[56px] md:text-[68px] lg:text-[76px]"
            style={{ animationDelay: "0.12s" }}
          >
            {HERO.titleA}
            <br />
            <span className="text-accent-gradient">{HERO.titleB}</span>
          </h1>

          <p
            className="tl-blur-in mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "0.24s" }}
          >
            {HERO.subtitle}
          </p>

          <div
            className="tl-blur-in mt-10 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "0.36s" }}
          >
            <Link href={HERO.ctaPrimary.href} className="btn btn-primary btn-lg">
              {HERO.ctaPrimary.label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href={HERO.ctaSecondary.href} className="btn btn-secondary btn-lg">
              {HERO.ctaSecondary.label}
            </Link>
          </div>

          <div
            className="tl-blur-in mt-8 flex flex-wrap items-center gap-2"
            style={{ animationDelay: "0.48s" }}
          >
            {["1 Token = 1 brief publié", "1 Token = 1 contact débloqué", "0 commission"].map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-[#141414]/85 px-3 py-1.5 text-[13px] font-medium text-muted-foreground"
              >
                <Check className="size-3.5 text-primary" aria-hidden="true" />
                {s}
              </span>
            ))}
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="tl-blur-in relative mx-auto w-full max-w-md" style={{ animationDelay: "0.32s" }} aria-hidden="true">
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(232,106,44,0.16),transparent)]" />

      <div className="card-elevated relative rounded-2xl border border-hairline bg-[#141414] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {HERO_DEMO.label}
          </span>
          <span className="badge badge-muted">
            <Check className="size-3" aria-hidden="true" />
            Devs sérieux uniquement
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-hairline bg-gradient-to-br from-[#1C1C1C] to-[#141414] p-5">
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
        </div>

        <div className="relative mt-5 space-y-3">
          {HERO_DEMO.flow.map((item) => (
            <div
              key={item.step}
              className="tl-drift relative flex items-center justify-between gap-3 rounded-xl border border-hairline bg-[#141414] px-4 py-3 shadow-sm"
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

      <div className="tl-float absolute -right-4 -top-5 rounded-full border border-hairline bg-[#141414] px-4 py-2.5 text-xs font-semibold shadow-lg shadow-black/5">
        Brief publié · 1 Token
      </div>
      <div
        className="tl-float absolute -bottom-5 -left-4 rounded-full bg-[#F2F2F2] px-4 py-2.5 text-xs font-semibold text-[#0D0D0D] shadow-xl shadow-black/40"
        style={{ animationDelay: "1.4s" }}
      >
        1 Token = 2 500 F · 1 contact
      </div>
    </div>
  );
}