"use client";

import * as React from "react";
import { COUNTRIES } from "@/lib/countries";
import { Flag } from "@/components/ui/Flag";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "cn";

/** Indicatif affiché tant qu'aucun numéro n'a été saisi (siège légal). */
const DEFAULT_DIAL = "+221";

/**
 * Découpe un numéro international en indicatif pays + partie nationale.
 *
 * On reconnaît l'indicatif en cherchant le préfixe d'un des pays du bassin
 * (`lib/countries.ts`). Un numéro sans indicatif reconnu est considéré comme
 * une saisie nationale sous l'indicatif par défaut (aucune devinette : on ne
 * force plus jamais un pays, le sélecteur le rend explicite).
 */
function parsePhone(value: string): { dial: string; national: string } {
  const digits = value.replace(/\D/g, "");
  if (!digits) return { dial: DEFAULT_DIAL, national: "" };
  for (const c of COUNTRIES) {
    const code = c.phoneCode.replace("+", "");
    if (digits.startsWith(code) && digits.length > code.length) {
      return { dial: c.phoneCode, national: digits.slice(code.length) };
    }
  }
  return { dial: DEFAULT_DIAL, national: digits };
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
}: PhoneInputProps) {
  const { dial, national } = React.useMemo(() => parsePhone(value), [value]);
  const country = COUNTRIES.find((c) => c.phoneCode === dial) ?? COUNTRIES[0];

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
          className={cn("shrink-0 gap-1.5", className)}
          aria-invalid={invalid || undefined}
        >
          <Flag countryCode={country.code} size={16} />
          <span className="tabular-nums">{dial}</span>
        </SelectTrigger>
        <SelectContent align="start">
          {COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.phoneCode}>
              <span className="flex items-center gap-2">
                <Flag countryCode={c.code} size={16} />
                <span className="tabular-nums">{c.phoneCode}</span>
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
        className={cn("min-w-0 flex-1 tabular-nums", className)}
      />
    </div>
  );
}
