import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PosterForm } from "@/components/poster-form";
import { getCurrentRole, getCurrentUser } from "@/lib/supabase/server";
import { Scene3D } from "@/components/landing/scene-3d";

export const metadata: Metadata = {
  title: "Poster un brief",
  description:
    "Publiez votre besoin de site web pour 1 Token. Les développeurs viennent à vous.",
  robots: { index: false, follow: false },
};

export default async function PosterPage() {
  const user = await getCurrentUser();
  const role = user ? await getCurrentRole() : null;

  if (!user) {
    return (
      <div className="bg-surface py-16 md:py-24">
        <div className="container-tl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="max-w-xl">
              <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Connectez-vous pour publier un brief
              </h1>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                La publication d’un brief coûte <strong className="text-foreground">1 Token</strong>.
                Créez un compte, commandez vos Tokens auprès de l’équipe (Wave ou
                Max It), puis décrivez votre projet : les développeurs vous contactent
                dans la messagerie interne.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/login" className="btn btn-primary">
                  Se connecter
                </Link>
                <Link href="/tokens" className="btn btn-secondary">
                  Acheter des Tokens
                </Link>
              </div>

              <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
                Pas encore de compte ?{" "}
                <Link href="/login?mode=signup" className="underline decoration-primary/60 underline-offset-4 hover:text-foreground">
                  Inscrivez-vous gratuitement
                </Link>{" "}
                — l’inscription est gratuite, seule la publication consomme 1 Token.
              </p>

              {/* SVG local de marque : next/image n'apporterait rien sur du vectoriel. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/illustrations/brief.svg"
                alt="Exemple de brief de projet web publié en deux minutes sur TERANGA LABS"
                width={480}
                height={360}
                loading="lazy"
                className="mt-10 w-full max-w-md rounded-2xl border border-hairline"
              />
            </div>
            <Scene3D variant="brief" className="hidden lg:block" />
          </div>
        </div>
      </div>
    );
  }

  const backHref = role === "client" ? "/client" : role === "developer" ? "/briefs" : "/";

  return (
    <div className="bg-surface py-6 md:py-10">
      <div className="container-tl">
        <div className="mx-auto max-w-xl">
          <div>
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Retour
            </Link>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
              Publier un brief
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Décris ton besoin. Les développeurs intéressés pourront te
              contacter directement dans la messagerie interne.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
            <PosterForm />
          </div>
        </div>
      </div>
    </div>
  );
}