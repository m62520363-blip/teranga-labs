"use client";

import * as React from "react";
import { X, ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export type OnboardingStep = {
  title: string;
  description: string;
  icon?: React.ReactNode;
};

export type OnboardingModalProps = {
  /** Clé unique pour le localStorage (ex. "onboarding-client"). */
  storageKey: string;
  /** Étapes du parcours. */
  steps: OnboardingStep[];
  /** Titre général. */
  welcomeTitle?: string;
  /** Sous-titre. */
  welcomeSubtitle?: string;
};

export function OnboardingModal({
  storageKey,
  steps,
  welcomeTitle = "Bienvenue sur Devmarket !",
  welcomeSubtitle = "Voici comment fonctionne la plateforme.",
}: OnboardingModalProps) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        setOpen(true);
      }
    } catch {
      // localStorage indisponible : on n'affiche pas.
    }
  }, [storageKey]);

  const close = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    setOpen(false);
    setStep(0);
  };

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!open || steps.length === 0) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-hairline bg-card p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Fermer"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        {step === 0 ? (
          <div className="text-center">
            <h2
              id="onboarding-title"
              className="font-headings text-xl font-bold tracking-tight"
            >
              {welcomeTitle}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {welcomeSubtitle}
            </p>
          </div>
        ) : null}

        <div className="mt-6">
          {current.icon ? (
            <div className="mb-3 flex justify-center text-primary">
              {current.icon}
            </div>
          ) : null}
          <h3 className="text-base font-semibold tracking-tight">
            {current.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {current.description}
          </p>
        </div>

        {/* Indicateurs */}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        {/* Boutons */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Précédent
          </Button>
          <Button
            size="sm"
            onClick={next}
            className="gap-1"
          >
            {isLast ? (
              <>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                C&apos;est parti !
              </>
            ) : (
              <>
                Suivant
                <ChevronRight className="size-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
