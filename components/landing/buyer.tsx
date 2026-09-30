import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { BUYER } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader } from "@/components/landing/section";

export function BuyerSection() {
  return (
    <Section className="border-y border-hairline bg-surface" ariaLabel="Pour les clients">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <SectionHeader
            align="left"
            eyebrow={BUYER.eyebrow}
            title={BUYER.title}
            lead={BUYER.lead}
          />
          <p className="mt-8 text-lg font-semibold tracking-tight">{BUYER.caption}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={BUYER.cta.href} className="btn btn-primary btn-lg">
              {BUYER.cta.label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              Sans abonnement, sans frais de publication
            </p>
          </div>
        </Reveal>

        <Reveal delay={1}>
          <div className="card-elevated mx-auto w-full max-w-sm p-7 sm:p-8">
            <div className="badge badge-muted">Aperçu du formulaire</div>

            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {BUYER.form.questionLabel}
              </label>
              <div className="mt-2 rounded-xl border border-hairline bg-card px-4 py-3 text-[15px] font-medium text-foreground">
                {BUYER.form.questionValue}
              </div>
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {BUYER.form.budgetLabel}
              </label>
              <div className="mt-2 rounded-xl border border-hairline bg-card px-4 py-3 text-[15px] font-medium text-foreground">
                {BUYER.form.budgetValue}
              </div>
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {BUYER.form.cityLabel}
              </label>
              <div className="mt-2 rounded-xl border border-hairline bg-card px-4 py-3 text-[15px] font-medium text-foreground">
                {BUYER.form.cityValue}
              </div>
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {BUYER.form.contactLabel}
              </label>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-hairline bg-card px-4 py-3">
                <span className="text-[15px] font-medium text-foreground">{BUYER.form.contactValue}</span>
                <span className="badge badge-muted">1 Token</span>
              </div>
            </div>

            <Link href={BUYER.cta.href} className="btn btn-primary mt-6 w-full">
              {BUYER.cta.label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}