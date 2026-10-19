import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import SupportTickets from "@/components/support-tickets";

export const metadata: Metadata = {
  title: "Support",
  description: "Ouvrez et suivez vos tickets de support TERANGA LABS.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  await requireUser();

  return (
    <div className="bg-background py-12">
      <div className="container-tl mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-semibold">Support</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une question, un problème ? Ouvrez un ticket : l&apos;équipe TERANGA LABS vous
          répond directement ici.
        </p>
        <div className="mt-8">
          <SupportTickets />
        </div>
      </div>
    </div>
  );
}