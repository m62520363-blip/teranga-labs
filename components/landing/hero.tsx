"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ArrowRight, Briefcase, Plus, Search, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import { HeroLaptop } from "@/components/landing/hero-laptop";

type DeveloperAvatar = {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string;
};

export function Hero({ developerAvatars = [] }: { developerAvatars?: DeveloperAvatar[] }) {
  const t = useTranslations("Landing.hero");
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const chips = t.raw("chips") as { label: string; query: string }[];

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/dev?q=${encodeURIComponent(term)}` : "/dev");
  };

  return (
    <section className="relative isolate overflow-hidden pb-20 pt-28 sm:pb-24 sm:pt-32 lg:pb-28 lg:pt-40">
      {/* Fond : dégradé navy + halo vert, dans l'esprit du grand bleu Codeur. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(120%_90%_at_50%_-10%,#16265c_0%,#0d1734_45%,#0b132b_70%,#080e20_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(57,255,136,0.10),transparent)]"
      />

      {/* Cercles concentriques : profondeur et superposition. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-26rem] -z-10 aspect-square w-[min(92rem,190vw)] -translate-x-1/2"
      >
        <span className="hero-ring absolute inset-0 rounded-full border border-white/[0.07]" />
        <span className="hero-ring absolute inset-[9%] rounded-full border border-white/[0.08]" />
        <span className="hero-ring absolute inset-[19%] rounded-full border border-white/[0.09]" />
        <span className="hero-ring absolute inset-[30%] rounded-full border border-primary/[0.12]" />
        <span className="absolute inset-[40%] rounded-full bg-[radial-gradient(closest-side,rgba(57,255,136,0.16),transparent_72%)]" />
      </div>

      <div className="container-tl relative">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          {/* Avatars réels des développeurs approuvés (comme Codeur.com) + preuve factuelle. */}
          {developerAvatars.length > 0 ? (
            <Link
              href="/dev"
              className="animate-rise group mb-4 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur transition-colors hover:border-primary/40 hover:bg-white/[0.1]"
            >
              <span className="flex -space-x-2" aria-hidden="true">
                {developerAvatars.map((dev) => (
                  <span
                    key={dev.id}
                    className="relative inline-block size-7 overflow-hidden rounded-full ring-2 ring-[#0b132b] sm:size-8"
                  >
                    <Image
                      src={dev.avatar_url}
                      alt={dev.name}
                      width={32}
                      height={32}
                      className="size-full object-cover"
                    />
                  </span>
                ))}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(57,255,136,0.8)]" />
                {t("socialProof")}
                <ArrowRight className="size-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ) : (
            <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(57,255,136,0.8)]" aria-hidden="true" />
              {t("socialProof")}
            </span>
          )}
          <div className="animate-rise flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.08] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {t("badge")}
            </span>
          </div>

          <h1
            className="animate-rise mt-6 text-balance font-headings text-4xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-[3.9rem]"
            style={{ "--rise-delay": "180ms" } as React.CSSProperties}
          >
            {t("titleBefore")}{" "}
            <span className="relative inline-block whitespace-nowrap text-primary">
              {t("titleHighlight")}
              <svg
                aria-hidden="true"
                viewBox="0 0 260 18"
                preserveAspectRatio="none"
                className="hero-underline absolute -bottom-2 left-0 h-3 w-full overflow-visible"
              >
                <path
                  d="M4 12C58 4 142 3 256 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            {t("titleAfter")}
          </h1>

          <p
            className="animate-rise mt-7 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg"
            style={{ "--rise-delay": "260ms" } as React.CSSProperties}
          >
            {t("subtitle")}
          </p>

          {/* Barre de recherche : blanche comme la référence, bouton vert. */}
          <form
            onSubmit={submit}
            role="search"
            aria-label={t("searchLabel")}
            className="animate-rise mt-9 flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-white/15 bg-white p-2 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.85)] transition-shadow duration-300 focus-within:shadow-[0_28px_80px_-20px_rgba(57,255,136,0.35)]"
            style={{ "--rise-delay": "330ms" } as React.CSSProperties}
          >
            <Search className="ml-2 size-5 shrink-0 text-[#0b132b]/45" aria-hidden="true" />
            <label htmlFor="hero-search" className="sr-only">
              {t("searchPlaceholder")}
            </label>
            <input
              id="hero-search"
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[#0b132b] outline-none placeholder:text-[#0b132b]/45 sm:text-base"
            />
            <button
              type="submit"
              className="btn-shine inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-ink transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-[#0b132b]/40 sm:px-6"
            >
              <span className="hidden sm:inline">{t("searchCta")}</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </form>

          {/* Raccourcis de catégories sous le champ. */}
          <div
            className="animate-rise mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-2"
            style={{ "--rise-delay": "400ms" } as React.CSSProperties}
          >
            <span className="text-xs font-medium text-white/60">{t("searchLabel")}</span>
            {chips.map((chip) => (
              <Link
                key={chip.label}
                href={`/dev?q=${encodeURIComponent(chip.query)}`}
                className="inline-flex h-8 items-center rounded-full border border-white/15 bg-white/[0.04] px-3.5 text-xs font-medium text-white/75 transition-colors outline-none hover:border-primary/50 hover:bg-primary/10 hover:text-white focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {chip.label}
              </Link>
            ))}
          </div>

          {/* Deux CTA clairement différenciés : Client (/poster) vs Développeur (/briefs). */}
          <div
            className="animate-rise mt-8 flex w-full max-w-xl flex-col items-stretch justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center"
            style={{ "--rise-delay": "470ms" } as React.CSSProperties}
          >
            <Link
              href="/poster"
              className="btn-shine inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-ink transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              {t("ctaPrimary")}
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
            <Link
              href="/briefs"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-primary/35 bg-primary-soft px-6 py-3 text-sm font-semibold text-primary transition-colors outline-none hover:border-primary/60 hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Briefcase className="size-4 shrink-0" aria-hidden="true" />
              {t("ctaSecondary")}
            </Link>
          </div>

          <p
            className="animate-rise mt-5 inline-flex items-center gap-2 text-xs text-white/70"
            style={{ "--rise-delay": "540ms" } as React.CSSProperties}
          >
            <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
            {t("ctaNote")}
          </p>

          {/* Aperçu produit 3D en perspective présentant l'écran réel /briefs. */}
          <HeroLaptop />
        </div>
      </div>
    </section>
  );
}
