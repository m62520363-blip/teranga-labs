import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ShieldCheck,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Benefit = { title: string; text: string };
type Row = { label: string; value: string };

const ICONS: LucideIcon[] = [BadgeCheck, Wallet, Zap];

/**
 * Section « Un service simple, rapide et transparent » — la section H.
 * Reprend l'argumentaire tarifaire de la référence et porte l'ancre
 * `#tarifs` (0 FCFA pour publier, 1 Token côté développeur, 0 % commission).
 */
export function Benefits() {
  const t = useTranslations("Landing.benefits");
  const items = t.raw("items") as Benefit[];
  const rows = t.raw("visual.rows") as Row[];

  return (
    <section
      id="tarifs"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-surface py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-1/4 size-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(57,255,136,0.10),transparent)]"
      />
      <div className="container-tl relative grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {t("eyebrow")}
          </span>
          <h2 className="mt-5 text-balance font-headings text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
            {t("title")}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("lead")}
          </p>

          <ul className="mt-9 flex flex-col gap-5">
            {items.map((item, index) => {
              const Icon = ICONS[index] ?? ShieldCheck;
              return (
                <li key={item.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-headings text-base font-semibold tracking-tight">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-9 flex flex-col gap-4">
            <Link
              href="/poster"
              className="btn-shine inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-ink transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {t("cta")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">{t("note")}</p>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(57,255,136,0.16),transparent)] blur-2xl"
          />
          <div className="card-elevate relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-card p-6 shadow-[0_40px_100px_-50px_rgba(0,0,0,0.9)] sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-headings text-5xl font-extrabold tracking-tight text-primary sm:text-6xl">
                  {t("visual.value")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("visual.label")}
                </p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-full border border-primary/25 bg-primary-soft text-primary">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
            </div>

            <dl className="mt-7 divide-y divide-hairline border-y border-hairline">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 py-3.5"
                >
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="size-4 text-primary" aria-hidden="true" />
                    {row.label}
                  </dt>
                  <dd className="font-headings text-sm font-bold text-foreground">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
              {t("note")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
