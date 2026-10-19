import Image from "next/image";
import { cn } from "cn";

/**
 * Officiel : `/logo.png` (lockup complet). Variante unique utilisée
 * partout — navbar, footer, sidebars V8, tiroir mobile, authentification.
 * L'ancien pictogramme SVG dessiné à la main a été retiré.
 */
export function ImageLogoMark({
  className,
  alt = "TERANGA LABS",
  priority = false,
}: {
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt={alt}
      width={2172}
      height={724}
      priority={priority}
      className={cn("h-8 w-auto", className)}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <span className="sr-only">TERANGA&nbsp;LABS</span>
      <ImageLogoMark />
    </span>
  );
}