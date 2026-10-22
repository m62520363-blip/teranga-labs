import { useTranslations } from "next-intl";
import { Quote } from "lucide-react";
import { SectionHeader } from "@/components/landing/section";

type Item = { quote: string; name: string; role: string; location: string };

/** Section témoignages : 3 cartes citation. */
export function Testimonials() {
  const t = useTranslations("Landing.testimonials");
  const items = t.raw("items") as Item[];
  return (
    <section className="border-t border-hairline py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionHeader
          eyebrow={t("badge")}
          title={
            <>
              {t("titleA")} <span className="text-primary">{t("titleB")}</span>
            </>
          }
          lead={t("lead")}
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((item) => (
            <figure
              key={item.name}
              className="flex h-full flex-col rounded-card border border-hairline bg-card p-6"
            >
              <Quote className="size-6 text-primary" aria-hidden="true" />
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                {item.quote}
              </blockquote>
              <figcaption className="mt-6 border-t border-hairline pt-4">
                <p className="font-headings font-semibold">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.role} · {item.location}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
          {t("note")}
        </p>
      </div>
    </section>
  );
}
