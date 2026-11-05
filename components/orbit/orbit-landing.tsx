"use client";

import { useState } from "react";
import { cn } from "cn";

type Billing = "monthly" | "annual";

const FEATURES = [
  {
    title: "Shared task boards",
    body: "Keep every task, owner and deadline in one place. No more scattered spreadsheets or lost Slack threads.",
  },
  {
    title: "Live project progress",
    body: "Watch milestones move in real time. Spot blockers early and keep delivery on track.",
  },
  {
    title: "AI focus assistant",
    body: "Orbit highlights what truly matters today, so your team spends time on work, not on sorting work.",
  },
];

const TESTIMONIALS = [
  {
    quote: "Orbit cut our weekly status meetings in half. Everyone knows what matters today.",
    name: "Awa Ndiaye",
    role: "Product Lead, Dakar",
  },
  {
    quote: "The progress view alone saved us from two missed deadlines last quarter.",
    name: "Koffi Mensah",
    role: "Engineering Manager, Abidjan",
  },
  {
    quote: "Simple, fast and focused. Our team adopted it in a day.",
    name: "Fatou Traoré",
    role: "Founder, Bamako",
  },
];

const TIERS = [
  { name: "Starter", monthly: 0, annual: 0, seats: "Up to 5 seats", cta: "Start free" },
  { name: "Pro", monthly: 12, annual: 10, seats: "Up to 25 seats", cta: "Start trial" },
  { name: "Enterprise", monthly: 49, annual: 39, seats: "Unlimited seats", cta: "Contact sales" },
];

const FAQS = [
  {
    q: "How long is the free trial?",
    a: "14 days, no credit card required. You get full access to every Pro feature.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. Upgrade, downgrade or cancel at any time from your workspace settings.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted in transit and at rest. We never sell or share your information.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Yes. Annual plans save up to 20% compared to monthly billing.",
  },
];

export function OrbitLanding() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [form, setForm] = useState({ name: "", email: "", company: "", size: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email is required.";
    if (!form.company.trim()) e.company = "Company is required.";
    if (!form.size) e.size = "Select a team size.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submitDemo(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) {
      setResult(null);
      return;
    }
    setResult(`Demo booked for ${form.name} (${form.email}). We will contact you within one business day.`);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-background/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6" aria-label="Primary">
          <a href="#hero" className="text-lg font-bold tracking-tight text-foreground">
            Orbit
          </a>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</a>
          </div>
          <a
            href="#demo"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Book a demo
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section id="hero" className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Help your team focus on what truly matters.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Orbit brings tasks, progress and priorities into one calm workspace, so your team spends time on work instead of on sorting work.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#demo" className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">
              Start free trial
            </a>
            <a href="#pricing" className="rounded-lg border border-hairline px-5 py-3 text-sm font-medium text-foreground hover:bg-muted/60">
              See pricing
            </a>
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6">
        <div className="rounded-2xl border border-hairline bg-card p-6 shadow-lg">
          <div className="flex items-center justify-between border-b border-hairline pb-4">
            <span className="text-sm font-medium text-foreground">Q3 Launch</span>
            <span className="text-sm text-muted-foreground">62% complete</span>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: "62%" }} />
          </div>
          <ul className="mt-6 space-y-3">
            {[
              { t: "Finalize onboarding flow", done: true },
              { t: "Review pricing page", done: true },
              { t: "Ship analytics dashboard", done: false },
              { t: "Prepare launch email", done: false },
            ].map((task) => (
              <li key={task.t} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded border",
                    task.done ? "border-primary bg-primary text-primary-foreground" : "border-hairline"
                  )}
                >
                  {task.done ? "✓" : ""}
                </span>
                <span className={task.done ? "text-muted-foreground line-through" : "text-foreground"}>{task.t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight">Three core features</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-hairline bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight">Loved by teams</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <blockquote key={t.name} className="rounded-2xl border border-hairline bg-card p-6">
              <p className="text-sm leading-relaxed text-foreground">“{t.quote}”</p>
              <footer className="mt-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t.name}</span> — {t.role}
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className="text-3xl font-bold tracking-tight">Pricing</h2>
          <div className="inline-flex rounded-lg border border-hairline bg-card p-1">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn("rounded-md px-4 py-2 text-sm font-medium", billing === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={cn("rounded-md px-4 py-2 text-sm font-medium", billing === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              Annual
            </button>
          </div>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => {
            const price = billing === "monthly" ? tier.monthly : tier.annual;
            return (
              <div key={tier.name} className="rounded-2xl border border-hairline bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  ${price}
                  <span className="text-base font-normal text-muted-foreground">/seat/mo</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{tier.seats}</p>
                <a
                  href="#demo"
                  className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  {tier.cta}
                </a>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight">Frequently asked questions</h2>
        <div className="mt-8 space-y-3">
          {FAQS.map((item, idx) => (
            <div key={item.q} className="rounded-2xl border border-hairline bg-card">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-medium text-foreground"
                aria-expanded={openFaq === idx}
              >
                {item.q}
                <span className="text-muted-foreground">{openFaq === idx ? "−" : "+"}</span>
              </button>
              {openFaq === idx && (
                <div className="px-6 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Demo form */}
      <section id="demo" className="mx-auto max-w-2xl px-5 py-20 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight">Book a demo</h2>
        <p className="mt-3 text-sm text-muted-foreground">Tell us about your team and we will get back to you.</p>
        <form onSubmit={submitDemo} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground" htmlFor="demo-name">Name</label>
            <input
              id="demo-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-foreground"
            />
            {errors.name && <p className="mt-1 text-xs text-error">{errors.name}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground" htmlFor="demo-email">Email</label>
            <input
              id="demo-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-foreground"
            />
            {errors.email && <p className="mt-1 text-xs text-error">{errors.email}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground" htmlFor="demo-company">Company</label>
            <input
              id="demo-company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-foreground"
            />
            {errors.company && <p className="mt-1 text-xs text-error">{errors.company}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground" htmlFor="demo-size">Team size</label>
            <select
              id="demo-size"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select…</option>
              <option value="1-5">1-5</option>
              <option value="6-25">6-25</option>
              <option value="26+">26+</option>
            </select>
            {errors.size && <p className="mt-1 text-xs text-error">{errors.size}</p>}
          </div>
          <button type="submit" className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">
            Submit request
          </button>
          {result && (
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">{result}</div>
          )}
        </form>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline py-10">
        <div className="mx-auto max-w-6xl px-5 text-sm text-muted-foreground sm:px-6">
          © 2026 Orbit. All rights reserved.
        </div>
      </footer>
    </div>
  );
}