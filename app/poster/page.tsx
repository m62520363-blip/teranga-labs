import type { Metadata } from "next";
import Link from "next/link";
import { PosterForm } from "@/components/poster-form";
import { getCurrentUser } from "@/lib/supabase/server";
import { Scene3D } from "@/components/landing/scene-3d";

export const metadata: Metadata = {
  title: "Poster un brief",
  description:
    "Publiez votre besoin de site web pour 1 Token. Les développeurs viennent à vous.",
  robots: { index: false, follow: false },
};

export default async function PosterPage() {
  const user = await getCurrentUser();

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

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-xl">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Poster un brief — 1 Token, 2 min
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Décrivez votre projet. Les développeurs intéressés vous
              écrivent dans la messagerie interne.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
            <PosterForm />
          </div>

          <h2 className="mt-8 text-sm font-semibold tracking-tight">
            En quelques points
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {["1 Token par brief", "2 minutes", "Sans engagement"].map((item) => (
              <li
                key={item}
                className="rounded-xl border border-hairline bg-card px-4 py-3 text-center text-sm font-medium"
              >
                {item}
              </li>
            ))}
          </ul>

          {/* SVG local de marque : next/image n'apporterait rien sur du vectoriel. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/brief.svg"
            alt="Exemple de brief de projet web publié en deux minutes sur TERANGA LABS"
            width={480}
            height={360}
            loading="lazy"
            className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-hairline"
          />
        </div>
      </div>
    </div>
  );
}