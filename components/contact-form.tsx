"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

/* Valeurs envoyées à la base (libellés FR stables) : le RPC
   submit_contact_message reçoit le libellé, quelle que soit la langue
   affichée — l'UI traduit séparément via Pages.contact.form.subjects. */
const DB_SUBJECTS = {
  tokens: "Acheter des Tokens",
  report: "Signaler un abus",
  technical: "Problème technique",
  other: "Autre demande",
};

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const t = useTranslations("Pages.contact.form");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("other");
  const [message, setMessage] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string>("");

  const labels = {
    tokens: t("subjects.tokens"),
    report: t("subjects.report"),
    technical: t("subjects.technical"),
    other: t("subjects.other"),
  };

  const reset = () => {
    setName("");
    setEmail("");
    setSubject("other");
    setMessage("");
    setStatus("idle");
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError("");

    const supabase = createClient();
    if (!supabase) {
      setError(t("errDb"));
      setStatus("error");
      return;
    }

    const { error: rpcError } = await supabase.rpc("submit_contact_message", {
      p_name: name,
      p_email: email,
      p_subject:
        subject === "other" ? null : DB_SUBJECTS[subject as keyof typeof DB_SUBJECTS],
      p_message: message,
    });

    if (rpcError) {
      setError(rpcError.message || t("errGeneric"));
      setStatus("error");
      return;
    }

    setStatus("success");
  };

  return (
    <div className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
      {status === "success" ? (
        <div className="flex flex-col items-start gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-success-soft">
              <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">{t("successTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("successBody", {
                  name:
                    name.trim().split(" ")[0] || t("successAnon"),
                })}
              </p>
            </div>
          </div>
          <Button variant="outline" className="h-9" onClick={reset}>
            {t("again")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("sub")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-name">
                {t("name")} <span className="text-primary">*</span>
              </Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("phName")}
                autoComplete="name"
                aria-describedby={status === "error" && error ? "contact-error" : undefined}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-email">
                {t("email")} <span className="text-primary">*</span>
              </Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("phEmail")}
                autoComplete="email"
                aria-describedby={status === "error" && error ? "contact-error" : undefined}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-subject">{t("subject")}</Label>
            <Select
              value={subject}
              onValueChange={(v) => setSubject(v ?? "other")}
              items={labels}
            >
              <SelectTrigger id="contact-subject" size="default" className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {Object.entries(labels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-message">
              {t("message")} <span className="text-primary">*</span>
            </Label>
            <Textarea
              id="contact-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("phMessage")}
              aria-describedby={status === "error" && error ? "contact-error" : undefined}
              required
            />
          </div>

          {status === "error" && error ? (
            <p
              id="contact-error"
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {t.rich("direct", {
                mail: (chunks) => (
                  <a
                    href="mailto:contact@devmarket.com"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
            <Button type="submit" disabled={status === "sending"} className="h-10">
              {status === "sending" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              {t("submit")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
