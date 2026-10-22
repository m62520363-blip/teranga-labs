import { useTranslations } from "next-intl";
import { Flag } from "@/components/ui/Flag";

/** Codes des 9 pays du périmètre (Afrique de l'Ouest francophone). */
const PERIMETER: { code: string; nameKey: string }[] = [
  { code: "SN", nameKey: "sn" },
  { code: "CI", nameKey: "ci" },
  { code: "ML", nameKey: "ml" },
  { code: "BF", nameKey: "bf" },
  { code: "NE", nameKey: "ne" },
  { code: "GN", nameKey: "gn" },
  { code: "GW", nameKey: "gw" },
  { code: "BJ", nameKey: "bj" },
  { code: "TG", nameKey: "tg" },
];

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
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          {PERIMETER.map((c) => (
            <li key={c.code} className="flex items-center gap-2">
              <Flag countryCode={c.code} size={24} alt="" />
              <span className="text-sm text-muted-foreground">{t(c.nameKey)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
