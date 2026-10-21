"use client";

import * as React from "react";
import {
  parseWorldDial,
  WORLD_DEFAULT_DIAL,
  WORLD_PHONE_COUNTRIES,
} from "@/lib/world-countries";
import { Flag } from "@/components/ui/Flag";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "cn";

/**
 * Indicatif + partie nationale d'un numéro international.
 *
 * Le découpage gère le MONDE entier (`lib/world-countries.ts`) : les dials
 * sont testés du plus long au plus court (+1242 avant +1), et un numéro
 * saisi sans « + » est une saisie nationale rattachée à l'indicatif par
 * défaut (siège légal) — aucune devinette, le sélecteur rend le choix
 * explicite. Le popup listé est DÉDUPLIQUÉ par indicatif (US/CA → « +1 »).
 */
function parsePhone(value: string): { dial: string; national: string } {
  return parseWorldDial(value);
}

export interface PhoneInputProps {
  /** Numéro international complet (ex. `+221771234567`) ou chaîne vide. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  /** Classes appliquées à la fois au sélecteur d'indicatif et au champ numéro. */
  className?: string;
  /**
   * Classes appliquées aux champs internes (indicatif + numéro) SEULEMENT,
   * sans toucher au conteneur flex. Permet de styler les champs comme un
   * champ unique sans bordure/padding parasite sur le wrapper.
   */
  fieldClassName?: string;
}

export function PhoneInput({
  value,
  onChange,
  id,
  placeholder = "77 123 45 67",
  invalid,
  disabled,
  autoComplete = "tel",
  className,
  fieldClassName,
}: PhoneInputProps) {
  const fieldClass = fieldClassName ?? className;
  const { dial, national } = React.useMemo(() => parsePhone(value), [value]);
  const country =
    WORLD_PHONE_COUNTRIES.find((c) => c.dial === dial) ??
    WORLD_PHONE_COUNTRIES.find((c) => c.dial === WORLD_DEFAULT_DIAL)!;

  const emit = (nextDial: string, nextNational: string) => {
    const digits = nextNational.replace(/\D/g, "");
    onChange(digits ? `${nextDial}${digits}` : "");
  };

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <Select
        value={dial}
        onValueChange={(v) => v && emit(v, national)}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label="Indicatif pays"
          className={cn("shrink-0 gap-1.5", fieldClass)}
          aria-invalid={invalid || undefined}
        >
          <Flag countryCode={country.iso2} size={16} />
          <span className="tabular-nums">{dial}</span>
        </SelectTrigger>
        <SelectContent align="start" className="max-h-80">
          {WORLD_PHONE_COUNTRIES.map((c) => (
            <SelectItem key={c.dial} value={c.dial}>
              <span className="flex items-center gap-2">
                <Flag countryCode={c.iso2} size={16} />
                <span className="tabular-nums">{c.dial}</span>
                <span className="text-muted-foreground">{c.nameFr}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        value={national}
        onChange={(e) => emit(dial, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn("min-w-0 flex-1 tabular-nums", fieldClass)}
      />
    </div>
  );
}
