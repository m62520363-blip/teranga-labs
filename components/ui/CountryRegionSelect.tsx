"use client"

import { useEffect, useMemo, useState } from "react"
import { COUNTRIES, getRegionsByCountry } from "@/lib/countries"

interface CountryRegionSelectProps {
  country?: string | null
  region?: string | null
  onCountryChange?: (country: string | null) => void
  onRegionChange?: (region: string | null) => void
  showAllOption?: boolean
  className?: string
  countryLabel?: string
  regionLabel?: string
  disabled?: boolean
}

export function CountryRegionSelect({
  country,
  region,
  onCountryChange,
  onRegionChange,
  showAllOption = true,
  className,
  countryLabel = "Pays",
  regionLabel = "Région",
  disabled = false,
}: CountryRegionSelectProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(country ?? null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(region ?? null)

  useEffect(() => {
    setSelectedCountry(country ?? null)
  }, [country])

  useEffect(() => {
    setSelectedRegion(region ?? null)
  }, [region])

  const regions = useMemo(() => getRegionsByCountry(selectedCountry), [selectedCountry])

  useEffect(() => {
    if (selectedCountry && selectedRegion) {
      const exists = regions.some((r) => r.code === selectedRegion)
      if (!exists) {
        setSelectedRegion(null)
        onRegionChange?.(null)
      }
    }
  }, [selectedCountry, selectedRegion, regions, onRegionChange])

  const handleCountryChange = (value: string) => {
    if (value === "all") {
      setSelectedCountry(null)
      setSelectedRegion(null)
      onCountryChange?.(null)
      onRegionChange?.(null)
      return
    }
    setSelectedCountry(value)
    setSelectedRegion(null)
    onCountryChange?.(value)
    onRegionChange?.(null)
  }

  const handleRegionChange = (value: string) => {
    if (value === "all") {
      setSelectedRegion(null)
      onRegionChange?.(null)
      return
    }
    setSelectedRegion(value)
    onRegionChange?.(value)
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="crs-country" className="mb-1 block text-xs font-medium text-muted-foreground">{countryLabel}</label>
          <select
            id="crs-country"
            value={selectedCountry ?? (showAllOption ? "all" : "")}
            onChange={(e) => handleCountryChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {showAllOption && <option value="all">Tous les pays</option>}
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.nameFr}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="crs-region" className="mb-1 block text-xs font-medium text-muted-foreground">{regionLabel}</label>
          <select
            id="crs-region"
            value={selectedRegion ?? (showAllOption ? "all" : "")}
            onChange={(e) => handleRegionChange(e.target.value)}
            disabled={disabled || !selectedCountry}
            className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {showAllOption && <option value="all">Toutes les régions</option>}
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
                {r.note ? " — (à confirmer)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
