import Link from "next/link";
import { AuthCard, type AuthRole } from "@/components/auth-card";
import { ImageLogoMark } from "@/components/logo";
import { cn } from "cn";

/**
 * Coquille des pages d'authentification, calquée sur la référence Montaaj :
 * une colonne centrée `max-w-sm` sur fond plein, logo en tête (lien vers
 * l'accueil), aucun décor d'arrière-plan ni chrome de navigation.
 */
export function AuthShell({
  mode,
  initialRole = "client",
  next = null,
}: {
  mode: "login" | "signup";
  initialRole?: AuthRole;
  next?: string | null;
}) {
  const isLogin = mode === "login";

  return (
    <main
      className={cn(
        "flex min-h-screen flex-col items-center justify-center bg-background px-5",
        isLogin ? "py-10" : "py-6"
      )}
    >
      <div className={cn("w-full max-w-sm", !isLogin && "flex flex-col gap-4")}>
        <div
          className={cn(
            isLogin
              ? "mb-8 flex flex-col items-center gap-3 text-center"
              : "flex flex-col items-center text-center"
          )}
        >
          <Link
            href="/"
            aria-label="Devmarket — accueil"
            className="inline-flex items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <ImageLogoMark priority className="h-16 w-auto" alt="" />
          </Link>
          {isLogin && (
            <div>
              <h1 className="font-headings text-[1.75rem]! font-bold tracking-tight">
                Content de vous revoir.
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Connectez-vous pour continuer.
              </p>
            </div>
          )}
        </div>

        <AuthCard mode={mode} initialRole={initialRole} next={next} />
      </div>
    </main>
  );
}
