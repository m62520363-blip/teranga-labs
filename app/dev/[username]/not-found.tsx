import Link from "next/link";

export default function DevNotFound() {
  return (
    <div className="bg-[#0A0A0A] py-24">
      <div className="container-tl mx-auto max-w-md text-center">
        <p className="text-6xl font-bold text-primary">404</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Développeur introuvable
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Ce profil n’existe pas ou n’est pas encore publié. Revenez à
          l’accueil pour découvrir les développeurs disponibles.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-medium text-ink transition-colors hover:bg-[#EBEBEB]"
        >
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}