import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "Cette page n’existe pas ou a été déplacée.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="bg-background py-24">
      <div className="container-tl mx-auto max-w-md text-center">
        <p className="text-6xl font-bold text-primary">404</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Page introuvable
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Cette page n’existe pas ou a été déplacée. Retrouvez les briefs
          disponibles, ou revenez à l’accueil.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/briefs"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-medium text-ink transition-colors hover:bg-foreground"
          >
            Voir les briefs
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline px-5 text-sm font-medium transition-colors hover:bg-card"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </div>
  );
}