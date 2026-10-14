"use client"

import { COUNTRIES } from "@/lib/countries"
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
} from "@/components/ui/select"
import { cn } from "cn"

interface RegionSelectContentProps {
  align?: "start" | "center" | "end"
  className?: string
}

/**
 * Contenu d'un `Select` listant toutes les régions du périmètre (9 pays),
 * groupées par pays. La valeur émise est le **nom** de région — c'est ce que
 * stockent `client_city` / `city` (le pays est dérivé par `lib/geography.ts`).
 * Un seul nom est ambigu (« Savanes » en CI et TG) : sans migration DB, les
 * deux émettent « Savanes ».
 */
export function RegionSelectContent({ align = "start", className }: RegionSelectContentProps) {
  return (
    <SelectContent align={align} className={cn("max-h-72", className)}>
      {COUNTRIES.map((country) => (
        <SelectGroup key={country.code}>
          <SelectLabel>{country.nameFr}</SelectLabel>
          {country.regions.map((region) => (
            <SelectItem
              key={`${country.code}-${region.code}`}
              value={region.name}
            >
              {region.name}
              {region.note ? " — (à confirmer)" : ""}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </SelectContent>
  )
}
