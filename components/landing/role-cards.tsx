import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Check, Code2, UserRound } from "lucide-react";
import Image from "next/image";
import { cn } from "cn";

const CARDS = [
  { key: "client", href: "/poster", highlighted: false, icon: UserRound, photo: "/landing/role-card-client.jpg" },
  { key: "developer", href: "/briefs", highlighted: true, icon: Code2, photo: "/landing/role-card-developer.jpg" },
] as const;

/**
 * Section finale « Un espace pour chaque rôle » — la section L.
 * Deux cartes actionnables, avec checklist et CTA vers les vrais parcours.
 */
export function RoleCards() {
  const t = useTranslations("Landing.roleCards");

  return (
    <section
      id="commencer"
      className="scroll-mt-24 border-t border-hairline bg-surface py-20 sm:py-28"
      aria-labelledby="role-cards-title"
    >
      <div className="container-tl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {t("eyebrow")}
          </span>
          <h2
            id="role-cards-title"
            className="mt-5 text-balance font-headings text-3xl font-bold tracking-tight sm:text-4xl"
          >
            {t("title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("lead")}
          </p>
        </div>

        <div className="mt-11 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {CARDS.map((card) => {
            const bullets = t.raw(`${card.key}.bullets`) as string[];
            const Icon = card.icon;
            return (
              <article
                key={card.key}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-[1.75rem] border p-6 sm:p-8",
                  card.highlighted
                    ? "border-primary/30 bg-[linear-gradient(155deg,rgba(57,255,136,0.12),rgba(17,26,54,0.4)_45%,rgba(17,26,54,1))]"
                    : "border-hairline bg-card"
                )}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute -right-20 -top-20 size-52 rounded-full",
                    card.highlighted
                      ? "bg-[radial-gradient(closest-side,rgba(57,255,136,0.16),transparent)]"
                      : "bg-[radial-gradient(closest-side,rgba(255,255,255,0.05),transparent)]"
                  )}
                />
                <div className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/10">
                  <Image
                    src={card.photo}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    aria-hidden="true"
                  />
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-0",
                      card.highlighted
                        ? "bg-gradient-to-t from-[#0b132b]/60 via-transparent to-transparent"
                        : "bg-gradient-to-t from-card/70 via-transparent to-transparent"
                    )}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl border",
                      card.highlighted
                        ? "border-primary/30 bg-primary/15 text-primary"
                        : "border-hairline bg-background text-muted-foreground"
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    {t(`${card.key}.eyebrow`)}
                  </span>
                </div>

                <h3 className="mt-5 font-headings text-2xl font-bold tracking-tight sm:text-[1.7rem]">
                  {t(`${card.key}.title`)}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {t(`${card.key}.text`)}
                </p>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Check className="size-3" aria-hidden="true" />
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <Link
                    href={card.href}
                    className={cn(
                      "btn-shine inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-[filter,background-color,border-color] outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      card.highlighted
                        ? "bg-primary text-ink hover:brightness-110 active:brightness-95"
                        : "border border-primary/30 bg-primary-soft text-primary hover:border-primary/60 hover:bg-primary/15"
                    )}
                  >
                    {t(`${card.key}.cta`)}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
