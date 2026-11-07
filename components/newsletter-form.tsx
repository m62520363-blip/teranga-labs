"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Check } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error" | "invalid";

/**
 * Formulaire d'abonnement newsletter (B16). Envoie POST /api/newsletter
 * (route publique rate-limitée). La réponse est `ok: true` même si
 * l'email est déjà inscrit — pas de disclosure. Accessible : le champ
 * a un <label>, l'état est annoncé via role="status".
 */
export function NewsletterForm() {
  const t = useTranslations("Footer.newsletter");
  const locale = useLocale();
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, locale, source: "footer" }),
      });
      if (res.status === 400) {
        setStatus("invalid");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  const message =
    status === "success"
      ? t("success")
      : status === "error"
        ? t("error")
        : status === "invalid"
          ? t("invalid")
          : null;

  return (
    <form onSubmit={submit} className="mt-4" noValidate>
      <label htmlFor="newsletter-email" className="sr-only">
        {t("placeholder")}
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          placeholder={t("placeholder")}
          disabled={status === "loading" || status === "success"}
          aria-describedby="newsletter-status"
          aria-invalid={status === "invalid" || status === "error"}
          className="h-11 min-w-0 flex-1 rounded-full border border-hairline bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          aria-label={t("cta")}
          className="btn-shine inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : status === "success" ? (
            <Check className="size-4" aria-hidden="true" />
          ) : null}
          {status === "loading" ? t("loading") : t("cta")}
        </button>
      </div>
      <p
        id="newsletter-status"
        role="status"
        aria-live="polite"
        className={
          "mt-2 min-h-4 text-xs " +
          (status === "success"
            ? "text-success"
            : status === "error" || status === "invalid"
              ? "text-error"
              : "text-muted-foreground")
        }
      >
        {message ?? (status === "idle" ? "" : "")}
      </p>
    </form>
  );
}
