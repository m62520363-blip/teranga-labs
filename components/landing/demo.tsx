import Link from "next/link";
import { ArrowRight, Bell, MapPin, Wallet } from "lucide-react";
import { DEMO } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader } from "@/components/landing/section";
import { cn } from "cn";

export function DemoSection() {
  return (
    <Section className="overflow-hidden" ariaLabel="Démonstration du produit">
      <div className="mx-auto max-w-2xl text-center">
        <SectionHeader eyebrow={DEMO.eyebrow} title={DEMO.title} lead={DEMO.lead} />
      </div>

      <Reveal delay={1} className="mx-auto mt-16 w-full max-w-3xl">
        <div className="card-elevated relative overflow-hidden rounded-3xl border bg-card">
          <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="size-3 rounded-full bg-border-strong" />
              <span className="size-3 rounded-full bg-border-strong" />
              <span className="size-3 rounded-full bg-border-strong" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Démo — interface illustrative
            </span>
          </div>

          <div className="grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="border-b border-hairline bg-gradient-to-br from-muted to-card p-6 md:border-b-0 md:border-r">
              <p className="text-[15px] font-semibold leading-snug tracking-tight">
                {DEMO.request.title}
              </p>
              <div className="mt-4 space-y-2.5">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="size-4 text-primary" aria-hidden="true" />
                  {DEMO.request.budget}
                </p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="size-4 text-primary" aria-hidden="true" />
                  {DEMO.request.location}
                </p>
              </div>
              <p className="mt-6 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Bell className="size-3.5 text-primary" aria-hidden="true" />
                Brief publié
              </p>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {DEMO.flow.map((step, index) => (
                  <div
                    key={step.step}
                    className="tl-drift flex items-center justify-between gap-3 rounded-xl border border-hairline bg-card px-4 py-3.5"
                    style={{ animationDelay: `${0.3 + index * 0.45}s` }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold tracking-tight">
                          {step.step}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {step.badge}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        step.badgeTone === "success"
                          ? "bg-success-soft text-success"
                          : "bg-primary-soft text-primary"
                      )}
                    >
                      {step.badgeTone === "success" ? "Direct" : "1 Token"}
                    </span>
                  </div>
                ))}
              </div>
              <Link href={DEMO.cta.href} className="btn btn-secondary mt-5 w-full">
                {DEMO.cta.label}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}