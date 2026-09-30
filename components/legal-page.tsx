import type { ReactNode } from "react";
import { cn } from "cn";

export function LegalPage({
  title,
  lead,
  updated,
  sections,
}: {
  title: string;
  lead: string;
  updated: string;
  sections: { heading: string; body: ReactNode }[];
}) {
  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {lead}
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Dernière mise à jour : {updated}
          </p>

          <div className="mt-10 space-y-10">
            {sections.map((section, index) => (
              <section key={section.heading}>
                <h2
                  className={cn(
                    "flex items-center gap-3 font-semibold tracking-tight",
                    index === 0 ? "text-2xl" : "text-xl"
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-3 pl-10 text-[15px] leading-relaxed text-muted-foreground">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}