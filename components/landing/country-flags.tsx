import { useTranslations } from "next-intl";
import { Flag } from "@/components/ui/Flag";
import { COUNTRIES } from "@/lib/countries";

/** Bande de drapeaux des pays desservis, sous le hero. */
export function CountryFlags() {
  const t = useTranslations("Landing.flags");
  return (
    <section
      aria-label={t("label")}
      className="border-t border-hairline bg-surface py-10"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <p className="text-center text-sm text-muted-foreground">{t("lead")}</p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
          {COUNTRIES.map((c) => (
            <li key={c.code} className="flex items-center gap-2">
              <Flag countryCode={c.code} size={24} alt="" />
              <span className="text-sm text-muted-foreground">{c.nameFr}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}