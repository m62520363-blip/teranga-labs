import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { ReviewForm } from "@/components/review/review-form";
import type { ReviewForRequest } from "@/types/database";

export const metadata: Metadata = {
  title: "Évaluez votre expérience",
  description:
    "Partagez votre avis et votre note après une mission TERANGA LABS.",
};

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="bg-surface py-16">
        <div className="container-tl mx-auto max-w-md text-center">
          <h1 className="text-2xl font-semibold">Configuration requise</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Connexion à Supabase manquante.
          </p>
        </div>
      </div>
    );
  }

  const roleRes = await supabase.rpc("get_my_role");
  if (roleRes.data !== "client") redirect("/dashboard");

  const { data, error } = await supabase.rpc("get_review_for_request", {
    p_request_id: id,
  });

  const errorHint =
    error && typeof error.message === "string"
      ? error.message.replace(/.*TL\w{3}/, "").trim()
      : null;

  if (error || !data) {
    return (
      <div className="bg-surface py-16 md:py-24">
        <div className="container-tl mx-auto max-w-md">
          <div className="rounded-2xl border border-hairline bg-[#141414] p-6 text-center">
            <h1 className="text-xl font-semibold">Accès refusé</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {errorHint ?? "Cette mission ne vous permet pas de déposer un avis."}
            </p>
            <Link href="/client" className="btn btn-primary mt-6">
              Retour à mon espace client
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface py-12 md:py-16">
      <div className="container-tl max-w-2xl">
        <Link
          href="/client"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Mon espace client
        </Link>
        <ReviewForm context={data as ReviewForRequest} />
      </div>
    </div>
  );
}