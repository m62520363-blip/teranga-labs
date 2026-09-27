import { AuthCard } from "@/components/auth-card";
import { ImageLogoMark } from "@/components/logo";

export function AuthShell({
  mode,
}: {
  mode: "login" | "signup";
}) {
  return (
    <div className="relative isolate overflow-hidden bg-[#0A0A0A] py-14 md:py-20">
      {/* halos d’arrière-plan */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[#E86A2C]/10 blur-[110px]" />
      <div className="glow-orb pointer-events-none absolute -right-40 top-40 hidden size-[26rem] lg:block" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />

      <div className="container-tl relative">
        <div className="flex flex-col items-center gap-8 md:gap-10">
          <ImageLogoMark className="h-12 w-auto" />
          <h1 className="sr-only">
            {mode === "login" ? "Connexion" : "Créer un compte"}
          </h1>
          <div className="w-full max-w-5xl">
            <AuthCard initialMode={mode} />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            En vous connectant, vous acceptez nos{" "}
            <a
              href="/conditions-utilisation"
              className="font-medium text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground"
            >
              conditions d’utilisation
            </a>{" "}
            et notre{" "}
            <a
              href="/politique-de-confidentialite"
              className="font-medium text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground"
            >
              politique de confidentialité
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}