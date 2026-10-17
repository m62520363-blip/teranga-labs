import Link from "next/link";
import { Check } from "lucide-react";
import { ROLE_CARDS } from "@/components/landing/content";
import { cn } from "cn";

/** Section finale : deux cartes rôles (Client / Développeur) avec checklist + CTA. */
export function RoleCards() {
  const cards = [
    { ...ROLE_CARDS.client, highlighted: false },
    { ...ROLE_CARDS.developer, highlighted: true },
  ];

  return (
    <section className="pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.eyebrow}
              className={cn(
                "rounded-card border bg-card",
                card.highlighted ? "border-primary/20 bg-primary-soft" : "border-hairline"
              )}
            >
              <div className="flex h-full flex-col p-6 sm:p-8">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {card.eyebrow}
                </span>
                <h3 className="mt-2 font-headings text-2xl font-bold tracking-tight">
                  {card.title}
                </h3>
                <p className="mt-3 text-muted-foreground">{card.text}</p>
                <ul className="mt-6 flex flex-col gap-3">
                  {card.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link
                    href={card.cta.href}
                    className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    {card.cta.label}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
