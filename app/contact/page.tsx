import type { Metadata } from "next";
import Link from "next/link";
import { Clock, HelpCircle, Send } from "lucide-react";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contactez l’équipe TERANGA LABS : question, signalement d’abus ou besoin d’acheter des Tokens.",
};

const topics = [
  { title: "Acheter des Tokens", text: "Sur commande, transaction par l’équipe. Paiement en ligne bientôt." },
  { title: "Signaler un abus", text: "Faux profil, brief fictif, sollicitation hors sujet : on vérifie chaque signalement." },
  { title: "Problème technique", text: "Connexion, messagerie, compte : décrivez le problème, on corrige." },
];

export default function ContactPage() {
  return (
    <div className="bg-[#0F0F0F] py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-2xl">
          <span className="chip gap-2 bg-[#141414]/85 border-[#2A2A2A] backdrop-blur">
            <HelpCircle className="size-3.5 text-[#E86A2C]" aria-hidden="true" />
            Support
          </span>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Contact
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Une question, un signalement d’abus, ou besoin d’acheter des Tokens
            ? Écrivez-nous, on répond vite.
          </p>

          <div className="mt-10 space-y-4">
            <ContactForm />

            <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6">
              <h2 className="text-sm font-semibold tracking-tight">À quoi sert le contact ?</h2>
              <div className="mt-4 space-y-4">
                {topics.map((t) => (
                  <div key={t.title} className="flex items-start gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#E86A2C]" aria-hidden="true" />
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <strong className="font-semibold text-foreground">{t.title}</strong>
                      {" — "}
                      {t.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <p className="flex items-center gap-2 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 text-sm leading-relaxed text-muted-foreground">
              <Send className="size-4 shrink-0 text-[#E86A2C]" aria-hidden="true" />
              L’achat de Tokens se fait auprès de l’équipe par écrit. Le paiement
              en ligne arrive bientôt.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-2 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Consultez d’abord la{" "}
              <Link href="/faq" className="font-medium text-[#E86A2C] underline underline-offset-2">
                FAQ
              </Link>
              , votre réponse s’y trouve peut-être déjà.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4 text-[#E86A2C]" aria-hidden="true" />
              Lundi – samedi, 9 h – 19 h GMT
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}