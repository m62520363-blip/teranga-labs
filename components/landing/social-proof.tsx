import { useTranslations } from "next-intl";
import { Quote, ShieldCheck } from "lucide-react";

type Stat = { value: string; label: string };
type Testimonial = {
  quote: string;
  name: string;
  role: string;
  location: string;
};

/**
 * Section « Une plateforme pensée pour la confiance » — la section J.
 *
 * Les quatre chiffres sont des faits produit (périmètre, délais, coût),
 * jamais des volumes d'utilisateurs inventés. Les témoignages sont des
 * exemples de démonstration : chacun porte le badge « Démo » et la note
 * de bas de section le rappelle explicitement.
 */
export function SocialProof() {
  const t = useTranslations("Landing.socialProof");
  const stats = t.raw("stats") as Stat[];
  const testimonials = t.raw("testimonials") as Testimonial[];

  return (
    <section
      id="confiance"
      className="scroll-mt-24 border-t border-hairline bg-surface py-20 sm:py-28"
    >
      <div className="container-tl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {t("eyebrow")}
          </span>
          <h2 className="mt-5 text-balance font-headings text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            {t("title")}
          </h2>
        </div>

        <div className="mt-11 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-card p-7 sm:p-9">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-[radial-gradient(closest-side,rgba(57,255,136,0.18),transparent)]"
            />
            <span className="flex size-11 items-center justify-center rounded-full border border-primary/25 bg-primary-soft text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-6 font-headings text-6xl font-extrabold tracking-tight text-primary sm:text-7xl">
              {t("bigValue")}
            </p>
            <p className="mt-2 font-headings text-lg font-semibold tracking-tight">
              {t("bigLabel")}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("bigText")}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col justify-center rounded-2xl border border-hairline bg-card p-5 sm:p-6"
              >
                <dt className="font-headings text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
                  {stat.value}
                </dt>
                <dd className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-16">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="font-headings text-2xl font-bold tracking-tight sm:text-3xl">
              {t("testimonialsTitle")}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("testimonialsLead")}
            </p>
          </div>

          <ul className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <li
                key={testimonial.name + testimonial.quote.slice(0, 24)}
                className="flex flex-col rounded-2xl border border-hairline bg-card p-5 sm:p-6"
              >
                <div className="flex items-center justify-between gap-2">
                  <Quote className="size-6 text-primary/50" aria-hidden="true" />
                  <span className="inline-flex items-center rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("demoBadge")}
                  </span>
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
                  « {testimonial.quote} »
                </blockquote>
                <div className="mt-5 flex items-center gap-3 border-t border-hairline pt-4">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-soft font-headings text-[11px] font-bold text-primary"
                  >
                    {initials(testimonial.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{testimonial.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {testimonial.role} · {testimonial.location}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("demoNote")}
          </p>
        </div>
      </div>
    </section>
  );
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "DM"
  );
}
