import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { ProfileForm } from "@/components/client/profile-form";

export const metadata: Metadata = {
  title: "Mon profil",
  description: "Gérez le nom affiché de votre compte Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const user = await requireUser();

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(meta.full_name ?? "").trim() || null;

  return (
    <div className="bg-surface py-6 md:py-10">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-hairline bg-card p-6 shadow-sm">
            <ProfileForm initialName={name} email={user.email ?? null} />
          </div>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Ton mot de passe et tes règles de compte sont dans{" "}
            <Link
              href="/parametres"
              className="font-medium text-foreground underline decoration-primary/60 underline-offset-4 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Paramètres
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
