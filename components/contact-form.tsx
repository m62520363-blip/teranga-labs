"use client";

import * as React from "react";
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

const SUBJECTS = {
  tokens: "Acheter des Tokens",
  report: "Signaler un abus",
  technical: "Problème technique",
  other: "Autre demande",
};

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("other");
  const [message, setMessage] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string>("");

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
      setError("Connexion à la base de données indisponible. Écrivez-nous à contact@terangalabs.sn.");
      setStatus("error");
      return;
    }

    const { error: rpcError } = await supabase.rpc("submit_contact_message", {
      p_name: name,
      p_email: email,
      p_subject: subject === "other" ? null : SUBJECTS[subject as keyof typeof SUBJECTS],
      p_message: message,
    });

    if (rpcError) {
      setError(rpcError.message || "Une erreur est survenue. Réessayez.");
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
              <p className="text-sm font-semibold">Message envoyé</p>
              <p className="text-sm text-muted-foreground">
                Merci {name.trim().split(" ")[0] || "de nous avoir écrit"} ! On
                vous répond sous 24 h ouvrées.
              </p>
            </div>
          </div>
          <Button variant="outline" className="h-9" onClick={reset}>
            Envoyer un autre message
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Écrivez-nous
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Réponse sous 24 h ouvrées, du lundi au samedi.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-name">
                Votre nom <span className="text-primary">*</span>
              </Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Awa Diop"
                autoComplete="name"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-email">
                Votre email <span className="text-primary">*</span>
              </Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.sn"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-subject">Objet</Label>
            <Select
              value={subject}
              onValueChange={(v) => setSubject(v ?? "other")}
              items={SUBJECTS}
            >
              <SelectTrigger id="contact-subject" size="default" className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {Object.entries(SUBJECTS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-message">
              Votre message <span className="text-primary">*</span>
            </Label>
            <Textarea
              id="contact-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Décrivez votre demande : achat de Tokens, signalement d’abus, problème technique…"
              required
            />
          </div>

          {status === "error" && error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Vous préférez un email direct ?{" "}
              <a
                href="mailto:contact@terangalabs.sn"
                className="font-medium text-primary underline underline-offset-2"
              >
                contact@terangalabs.sn
              </a>
            </p>
            <Button type="submit" disabled={status === "sending"} className="h-10">
              {status === "sending" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              Envoyer
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}