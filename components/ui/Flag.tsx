// components/ui/Flag.tsx
import { getFlagUrl } from "@/lib/countries"

interface FlagProps {
  countryCode?: string | null
  size?: 16 | 20 | 24 | 32 | 48
  className?: string
  alt?: string
}

export function Flag({ countryCode, size = 20, className, alt }: FlagProps) {
  const src = getFlagUrl(countryCode, size)
  const altText = alt ?? (countryCode ? `Drapeau ${countryCode.toUpperCase()}` : "Drapeau")
  return (
    <img
      src={src}
      alt={altText}
      loading="lazy"
      decoding="async"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    />
  )
}
