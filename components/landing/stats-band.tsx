import { useTranslations } from "next-intl";
import { Globe2, ShieldCheck, Timer, Users } from "lucide-react";

const ICONS = [Globe2, Users, Timer, ShieldCheck];

type Stat = { value: string; label: string; hint: string };

/** Bandeau de preuves sous le hero, à la manière des chiffres de Codeur.com. */
export function StatsBand() {
  const t = useTranslations("Landing.statsBand");
  const stats = t.raw("items") as Stat[];

  return (
    <section className="border-y border-hairline bg-surface-secondary/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-5 py-8 sm:px-6 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = ICONS[index % ICONS.length];
          return (
            <div key={stat.label} className="flex items-start gap-3 px-2 py-4 sm:px-6">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-headings text-2xl font-bold tracking-tight">
                  {stat.value}
                </p>
                <p className="text-sm font-medium">{stat.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.hint}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
