"use client";

import * as React from "react";

/**
 * Envoie un événement `profile_view` une seule fois par visite de page.
 * Le rendu est nul : ce composant ne sert qu'au suivi analytics.
 * L'échec réseau est silencieux (le parcours ne doit jamais en dépendre).
 */
const sent = new Set<string>();

export function ProfileViewTracker({ developerId }: { developerId: string }) {
  React.useEffect(() => {
    if (!developerId || sent.has(developerId)) return;
    sent.add(developerId);
    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "profile_view", developer_id: developerId }),
      keepalive: true,
    }).catch(() => {
      // Suivi best-effort uniquement.
    });
  }, [developerId]);

  return null;
}
