import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin, Send, Wallet } from "lucide-react";
import { SELLERS } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader } from "@/components/landing/section";

export function SellersSection() {
  return (
    <Section ariaLabel="Pour les développeurs">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <Reveal className="order-2 lg:order-1">
          <div className="card-elevated mx-auto w-full max-w-sm p-7 sm:p-8">
            <div className="flex items-center justify-between">
              <span className="badge badge-success">
                <BadgeCheck className="size-3" aria-hidden="true" />
                {SELLERS.notification.title}
              </span>
              <span className="text-[11px] text-muted-foreground">il y a 5 min</span>
            </div>

            <p className="mt-5 text-base font-semibold tracking-tight">
              {SELLERS.notification.text}
            </p>

            <div className="mt-4 space-y-2.5 rounded-xl bg-[#1E1E1E] p-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="size-4 text-[#E86A2C]" aria-hidden="true" />
                {SELLERS.notification.budget}
              </p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4 text-[#E86A2C]" aria-hidden="true" />
                {SELLERS.notification.location}
              </p>
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Coût du contact
              </label>
              <div className="mt-2 rounded-xl border border-[#2A2A2A] bg-[#141414] px-4 py-3 text-[15px] font-medium text-foreground">
                1 Token = 2 500 F
              </div>
            </div>

            <Link href={SELLERS.cta.href} className="btn btn-secondary mt-5 w-full">
              {SELLERS.notification.reply}
              <Send className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        <Reveal className="order-1 lg:order-2">
          <SectionHeader
            align="left"
            eyebrow={SELLERS.eyebrow}
            title={SELLERS.title}
            lead={SELLERS.lead}
          />
          <ul className="mt-8 space-y-3.5">
            {SELLERS.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E86A2C]/12">
                  <span className="size-1.5 rounded-full bg-[#E86A2C]" aria-hidden="true" />
                </span>
                <span className="text-[15px] text-muted-foreground">{benefit}</span>
              </li>
            ))}
          </ul>
          <div className="mt-9">
            <Link href={SELLERS.cta.href} className="btn btn-primary">
              {SELLERS.cta.label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}