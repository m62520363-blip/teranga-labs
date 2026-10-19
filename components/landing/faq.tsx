import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { TOKEN_LABEL_PRICED } from "@/lib/formatting";

/** Section FAQ : accordéons natifs <details>, « + » pivotant à l'ouverture. */
export function FaqSection() {
  const t = useTranslations("Landing");
  const count = (t.raw("faqs") as unknown[]).length;
  return (
    <section id="faq" className="scroll-mt-24 border-t border-hairline py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-6">
        <h2 className="text-center font-headings text-3xl font-bold tracking-tight sm:text-4xl">
          {t("faqHeading.a")} <span className="text-primary">{t("faqHeading.b")}</span>
        </h2>
        <div className="mt-10 flex flex-col gap-3">
          {Array.from({ length: count }, (_, i) => {
            const q = t(`faqs.${i}.q`);
            const a = t(`faqs.${i}.a`, { token: TOKEN_LABEL_PRICED });
            return (
              <details
                key={q}
                className="group rounded-card border border-hairline bg-card open:border-primary/30"
              >
                <summary className="tl-details-marker flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-headings text-base font-semibold">
                  {q}
                  <Plus
                    aria-hidden="true"
                    className="size-4 shrink-0 text-primary transition-transform group-open:rotate-45"
                  />
                </summary>
                <p className="px-5 pb-5 text-sm text-muted-foreground">{a}</p>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
