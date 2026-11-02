import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Coins, Settings } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { ProfileForm } from "@/components/client/profile-form";

export const metadata: Metadata = {
  title: "Mon profil",
  description: "Gérez votre profil, votre portefeuille et vos paramètres Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const user = await requireUser();

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(meta.full_name ?? "").trim() || null;
  const avatarUrl = String(meta.avatar_url ?? "").trim() || null;

  return (
    <div className="bg-surface py-6 md:py-10">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-2xl border border-hairline bg-card p-6 shadow-sm">
            <ProfileForm
              userId={user.id}
              initialName={name}
              initialAvatar={avatarUrl}
              email={user.email ?? null}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/wallet"
              className="group flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-card p-5 transition-colors hover:border-primary/50"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Coins className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold group-hover:text-primary">
                    Mon wallet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paiements, fonds bloqués et reçus
                  </p>
                </div>
              </div>
              <ArrowRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>

            <Link
              href="/parametres"
              className="group flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-card p-5 transition-colors hover:border-primary/50"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Settings className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold group-hover:text-primary">
                    Paramètres
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mot de passe, sécurité et déconnexion
                  </p>
                </div>
              </div>
              <ArrowRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
