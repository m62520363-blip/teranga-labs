import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";

/**
 * Bloc d'appel à l'action final, avant la preuve sociale et la FAQ.
 * Composition Codeur : grande surface contrastée, titre large, deux CTA.
 */
export function BigCta() {
  const t = useTranslations("Landing.bigCta");

  return (
    <section className="border-t border-hairline py-16 sm:py-20">
      <div className="container-tl">
        <div className="relative isolate overflow-hidden rounded-[2rem] border border-primary/20 bg-[radial-gradient(120%_120%_at_15%_0%,rgba(57,255,136,0.18),transparent_55%),linear-gradient(145deg,#111a36_0%,#0b132b_65%,#080e20_100%)] px-6 py-12 text-center shadow-[0_50px_120px_-60px_rgba(57,255,136,0.4)] sm:px-10 sm:py-16">
          <Image
            src="/landing/big-cta.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-25 mix-blend-luminosity"
            aria-hidden="true"
            priority={false}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(11,19,43,0.82)_0%,rgba(11,19,43,0.92)_60%,rgba(8,14,32,0.96)_100%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/[0.12]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(57,255,136,0.14),transparent)]"
          />

          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Devmarket
          </span>

          <h2 className="mx-auto mt-6 max-w-3xl text-balance font-headings text-3xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-5xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
            {t("lead")}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/poster"
              className="btn-shine inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-ink transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/60 sm:w-auto"
            >
              {t("cta")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/dev"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-7 py-3 text-sm font-medium text-white transition-colors outline-none hover:border-white/40 hover:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-primary/60 sm:w-auto"
            >
              {t("secondary")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
