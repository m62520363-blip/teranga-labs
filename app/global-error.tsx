"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[erreur globale]", error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          background: "#0b132b",
          color: "#f1f5ff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              color: "#39ff88",
              fontSize: "3rem",
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Erreur
          </p>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 600, margin: "1rem 0 0" }}>
            L’application n’a pas pu démarrer
          </h1>
          <p
            style={{
              color: "#9aa7c7",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              margin: "0.75rem 0 0",
            }}
          >
            Une erreur est survenue avant l’affichage de la page. Rechargez pour
            réessayer.
          </p>
          <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "#39ff88",
                color: "#0b132b",
                border: 0,
                borderRadius: "0.75rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
                padding: "0.7rem 1.25rem",
              }}
            >
              Recharger
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              style={{
                background: "transparent",
                color: "#f1f5ff",
                border: "1px solid #1e2a4e",
                borderRadius: "0.75rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
                padding: "0.7rem 1.25rem",
              }}
            >
              Accueil
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
