"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ArrowRight, Briefcase, Plus, Search, ShieldCheck, Sparkles, Zap, Globe, Users } from "lucide-react";
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
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const chips = t.raw("chips") as { label: string; query: string }[];

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/dev?q=${encodeURIComponent(term)}` : "/dev");
  };

  return (
    <section className="relative isolate overflow-hidden">
      {/* Background layers */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-30">
        <div className="absolute inset-0 bg-[#080e20]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(57,255,136,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(59,130,246,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_20%_80%,rgba(168,85,247,0.06),transparent)]" />
      </div>

      {/* Animated grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -left-20 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-20 right-1/4 h-40 w-40 rounded-full bg-purple-500/8 blur-3xl" />
      </div>

      <div className="container-tl relative pt-24 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-28">
        {/* Top badge */}
        {developerAvatars.length > 0 && (
          <div className="mb-8 flex justify-center">
            <Link
              href="/dev"
              className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur transition-all hover:border-primary/40 hover:bg-white/10"
            >
              <span className="flex -space-x-2">
                {developerAvatars.slice(0, 5).map((dev) => (
                  <span
                    key={dev.id}
                    className="relative inline-block size-7 overflow-hidden rounded-full ring-2 ring-[#080e20] sm:size-8"
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
          </div>
        )}

        {/* Main headline */}
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-7xl">
            <span className="block text-white">Trouvez le développeur</span>
            <span className="block bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              qui construira votre vision
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg lg:text-xl">
            {t("subtitle")}
          </p>

          {/* Search bar */}
          <form onSubmit={submit} className="mx-auto mt-10 flex max-w-2xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/40" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-4 text-base text-white placeholder:text-white/40 backdrop-blur transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-14 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-[#080e20] transition-all hover:brightness-110 active:brightness-95"
            >
              <Search className="size-4" aria-hidden="true" />
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
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition-all hover:border-primary/40 hover:bg-white/10 hover:text-white"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/poster"
              className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-[#080e20] transition-all hover:brightness-110 hover:shadow-[0_0_30px_rgba(57,255,136,0.3)]"
            >
              <Plus className="size-4" aria-hidden="true" />
              Publier un projet
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <Link
              href="/dev"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 text-sm font-medium text-white transition-all hover:border-white/30 hover:bg-white/10"
            >
              <Users className="size-4" aria-hidden="true" />
              Trouver un développeur
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { value: "54", label: "Pays couverts" },
            { value: "100+", label: "Développeurs" },
            { value: "0%", label: "Commission" },
            { value: "24h", label: "Temps de réponse" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur">
              <p className="text-2xl font-bold text-primary sm:text-3xl">{stat.value}</p>
              <p className="mt-1 text-xs text-white/50">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
