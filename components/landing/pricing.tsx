import { useTranslations } from "next-intl";
import { cn } from "cn";

type PricingCard = { eyebrow: string; price: string; text: string; highlighted: boolean };

/** Section tarifs : deux cartes (Client / Développeur), mise en avant secondaire. */
export function PricingSection() {
  const t = useTranslations("Landing.pricing");
  const cards = t.raw("cards") as PricingCard[];
  return (
    <section
      id="tarifs"
      className="flex min-h-screen scroll-mt-24 items-center border-t border-hairline py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <div className="text-center">
          <h2 className="font-headings text-4xl font-bold tracking-tight sm:text-5xl">
            {t("titleA")} <span className="text-primary">{t("titleB")}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            {t("lead")}
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.eyebrow}
              className={cn(
                "rounded-card border bg-card h-full",
                card.highlighted
                  ? "border-primary/20 bg-primary-soft"
                  : "border-hairline"
              )}
            >
              <div className="flex h-full flex-col p-8 text-center sm:p-10">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {card.eyebrow}
                </span>
                <p className="mt-4 font-headings text-5xl font-bold">{card.price}</p>
                <p className="mt-4 text-muted-foreground">{card.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
