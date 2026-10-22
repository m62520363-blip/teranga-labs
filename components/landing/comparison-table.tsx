import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { SectionHeader } from "@/components/landing/section";
import { cn } from "cn";

type Row = { feature: string; teranga: string; whatsapp: string; foreign: string };
type Headers = { feature: string; teranga: string; whatsapp: string; foreign: string };

/**
 * Tableau comparatif TERANGA vs groupes WhatsApp vs plateformes étrangères.
 * La colonne TERANGA est mise en avant (fond primaire léger). Sur mobile,
 * chaque ligne devient une carte empilée pour rester lisible.
 */
export function ComparisonTable() {
  const t = useTranslations("Landing.comparison");
  const rows = t.raw("rows") as Row[];
  const headers = t.raw("headers") as Headers;
  const cols: { key: keyof Headers; highlight?: boolean }[] = [
    { key: "teranga", highlight: true },
    { key: "whatsapp" },
    { key: "foreign" },
  ];

  return (
    <section className="border-t border-hairline bg-surface py-16 sm:py-20">
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

        {/* Desktop : vrai tableau */}
        <div className="mt-12 hidden overflow-hidden rounded-card border border-hairline md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-card">
                <th
                  scope="col"
                  className="px-5 py-4 text-left font-headings font-semibold"
                >
                  {headers.feature}
                </th>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      "px-5 py-4 text-center font-headings font-semibold",
                      c.highlight && "bg-primary-soft text-primary"
                    )}
                  >
                    {headers[c.key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feature} className="border-t border-hairline">
                  <th
                    scope="row"
                    className="px-5 py-4 text-left font-normal text-muted-foreground"
                  >
                    {row.feature}
                  </th>
                  {cols.map((c) => {
                    const val = row[c.key as keyof Row];
                    const isTeranga = c.key === "teranga";
                    return (
                      <td
                        key={c.key}
                        className={cn(
                          "px-5 py-4 text-center",
                          isTeranga && "bg-primary-soft font-medium text-foreground"
                        )}
                      >
                        {isTeranga ? (
                          <span className="inline-flex items-center justify-center gap-1.5">
                            <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                            {val}
                          </span>
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile : cartes empilées par fonctionnalité */}
        <div className="mt-12 flex flex-col gap-4 md:hidden">
          {rows.map((row) => (
            <div
              key={row.feature}
              className="rounded-card border border-hairline bg-card p-5"
            >
              <h3 className="font-headings font-semibold">{row.feature}</h3>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-lg bg-primary-soft px-3 py-2">
                  <dt className="font-medium text-primary">{headers.teranga}</dt>
                  <dd className="inline-flex items-center gap-1.5 text-right">
                    <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {row.teranga}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-1">
                  <dt className="text-muted-foreground">{headers.whatsapp}</dt>
                  <dd className="text-right text-muted-foreground">{row.whatsapp}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-1">
                  <dt className="text-muted-foreground">{headers.foreign}</dt>
                  <dd className="text-right text-muted-foreground">{row.foreign}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          {t("note")}
        </p>
      </div>
    </section>
  );
}
