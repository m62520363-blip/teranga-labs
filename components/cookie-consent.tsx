"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";

const CONSENT_COOKIE = "devmarket_cookie_consent";

function readConsent(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.split("=").slice(1).join("="));
  } catch {
    return null;
  }
}

function writeConsent(value: "all" | "essential") {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; secure"
      : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(
    value
  )}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${secure}`;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!readConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Consentement cookies"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[60] border-t border-hairline bg-card/95 backdrop-blur px-4 py-4 shadow-lg",
        "md:px-6"
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Devmarket utilise des cookies essentiels à l&apos;authentification et au
          bon fonctionnement du service. Aucun cookie publicitaire n&apos;est
          déposé. Vous pouvez choisir d&apos;accepter uniquement les cookies
          essentiels.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              writeConsent("essential");
              setVisible(false);
            }}
            className={cn(
              "rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-foreground",
              "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            )}
          >
            Essentiels uniquement
          </button>
          <button
            type="button"
            onClick={() => {
              writeConsent("all");
              setVisible(false);
            }}
            className={cn(
              "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
              "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            )}
          >
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
}