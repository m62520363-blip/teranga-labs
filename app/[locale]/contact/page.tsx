import type { Metadata } from "next";
import { Clock, HelpCircle, Send } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ContactForm } from "@/components/contact-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.contact");
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  };
}

export default async function ContactPage() {
  const t = await getTranslations("Pages.contact");
  const topics = t.raw("topics") as { title: string; text: string }[];
  const faqHint = t.rich("faqHint", {
    faq: (chunks) => (
      <Link
        href="/faq"
        className="font-medium text-primary underline underline-offset-2"
      >
        {chunks}
      </Link>
    ),
  });

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-2xl">
          <span className="chip gap-2 bg-card/85 border-hairline backdrop-blur">
            <HelpCircle className="size-3.5 text-primary" aria-hidden="true" />
            Support
          </span>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {t("h1")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {t("intro")}
          </p>

          <div className="mt-10 space-y-4">
            <ContactForm />

            <div className="rounded-2xl border border-hairline bg-card p-6">
              <h2 className="text-sm font-semibold tracking-tight">
                {t("topicsTitle")}
              </h2>
              <div className="mt-4 space-y-4">
                {topics.map((topic) => (
                  <div key={topic.title} className="flex items-start gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <strong className="font-semibold text-foreground">
                        {topic.title}
                      </strong>
                      {" — "}
                      {topic.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <p className="flex items-center gap-2 rounded-2xl border border-hairline bg-card p-6 text-sm leading-relaxed text-muted-foreground">
              <Send className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {t("purchase")}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-2 rounded-2xl border border-hairline bg-card p-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{faqHint}</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              {t("hours")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
