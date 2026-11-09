"use client";

import * as React from "react";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export function UTMTracker() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    let hasUtm = false;

    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) {
        utm[key] = value;
        hasUtm = true;
      }
    }

    if (!hasUtm) return;

    // Stocker dans sessionStorage pour la session
    try {
      sessionStorage.setItem("devmarket_utm", JSON.stringify(utm));
    } catch {
      // ignore
    }

    // Envoyer au serveur pour tracking (respecte le consentement cookies)
    const consent = document.cookie.includes("devmarket_cookie_consent=accepted");
    if (consent) {
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "utm_visit", metadata: utm }),
      }).catch(() => {});
    }
  }, []);

  return null;
}
