"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ArrowRight, Plus, Search, Zap, Globe, Users, CheckCircle2, ShieldCheck } from "lucide-react";
import Image from "next/image";

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
    <section className="relative isolate overflow-hidden">
      {/* Background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-30">
        <div className="absolute inset-0 bg-[#060a14]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_-30%,rgba(57,255,136,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_50%,rgba(59,130,246,0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_20%_70%,rgba(168,85,247,0.05),transparent_50%)]" />
      </div>

      {/* Animated grid pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Floating glow orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute top-1/4 -left-24 h-72 w-72 rounded-full bg-blue-500/6 blur-[100px]" />
        <div className="absolute bottom-0 right-1/3 h-56 w-56 rounded-full bg-purple-500/5 blur-[80px]" />
      </div>

      <div className="container-tl relative pt-28 pb-16 sm:pt-36 sm:pb-24 lg:pt-44 lg:pb-32">
        {/* Social proof badge */}
        {developerAvatars.length > 0 && (
          <div className="mb-10 flex justify-center">
            <Link
              href="/dev"
              className="group inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-white/[0.08] hover:text-white"
            >
              <span className="flex -space-x-2.5">
                {developerAvatars.slice(0, 6).map((dev) => (
                  <span
                    key={dev.id}
                    className="relative inline-block size-7 overflow-hidden rounded-full ring-2 ring-[#060a14] sm:size-8"
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
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                {t("socialProof")}
                <ArrowRight className="size-3.5 opacity-50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </div>
        )}

        {/* Main headline - asymmetric layout */}
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-8xl">
              <span className="block text-white/90">Votre projet web,</span>
              <span className="block bg-gradient-to-r from-primary via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                réalisé par les meilleurs.
              </span>
            </h1>

            <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg">
              {t("subtitle")}
            </p>
          </div>

          {/* Search bar - glassmorphism */}
          <form onSubmit={submit} className="mx-auto mt-12 flex max-w-2xl items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-white/30" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-16 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] pl-14 pr-5 text-base text-white placeholder:text-white/30 backdrop-blur-xl transition-all focus:border-primary/40 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-16 items-center gap-2 rounded-2xl bg-primary px-8 text-sm font-bold text-[#060a14] transition-all hover:shadow-[0_0_40px_rgba(57,255,136,0.25)] hover:brightness-110 active:brightness-95"
            >
              <Search className="size-5" aria-hidden="true" />
              <span className="hidden sm:inline">Rechercher</span>
            </button>
          </form>

          {/* Quick chips */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => router.push(`/dev?q=${encodeURIComponent(chip.query)}`)}
                className="rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/60 transition-all hover:border-primary/30 hover:bg-white/[0.08] hover:text-white"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/poster"
              className="group inline-flex h-14 items-center gap-2.5 rounded-2xl bg-primary px-7 text-sm font-bold text-[#060a14] transition-all hover:shadow-[0_0_50px_rgba(57,255,136,0.3)] hover:brightness-110"
            >
              <Plus className="size-5" aria-hidden="true" />
              Publier un projet
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <Link
              href="/dev"
              className="inline-flex h-14 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-7 text-sm font-medium text-white/90 transition-all hover:border-white/20 hover:bg-white/10"
            >
              <Users className="size-5" aria-hidden="true" />
              Trouver un développeur
            </Link>
          </div>
        </div>

        {/* Stats cards - bento style */}
        <div className="mx-auto mt-20 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { value: "54", label: "Pays couverts", icon: Globe },
            { value: "100+", label: "Développeurs", icon: Users },
            { value: "0%", label: "Commission", icon: Zap },
            { value: "24h", label: "Temps de réponse", icon: CheckCircle2 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-center backdrop-blur-sm transition-all hover:border-white/10 hover:bg-white/[0.06]"
            >
              <stat.icon className="mx-auto mb-2 size-5 text-primary/60 transition-colors group-hover:text-primary" aria-hidden="true" />
              <p className="text-3xl font-bold text-white sm:text-4xl">{stat.value}</p>
              <p className="mt-1 text-xs text-white/40">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Trust indicators */}
        <div className="mx-auto mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-white/40">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-primary/60" aria-hidden="true" />
            Paiement sécurisé (escrow)
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-primary/60" aria-hidden="true" />
            Développeurs vérifiés
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="size-4 text-primary/60" aria-hidden="true" />
            Réponse sous 48h
          </span>
        </div>
      </div>
    </section>
  );
}
