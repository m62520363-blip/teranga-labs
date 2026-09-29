import Image from "next/image";
import { cn } from "cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-8", className)}
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 9 H41" fill="none" />
        <path d="M24 9 V18" fill="none" />
        <path d="M24 20 C 14 23 6 28 5 38 C 14 35 22 30 24 25 Z" />
        <path d="M24 20 C 34 23 42 28 43 38 C 34 35 26 30 24 25 Z" />
        <path d="M25 44 V48 H33" fill="none" />
      </g>
      <circle cx="24" cy="31" r="2.3" className="fill-primary" />
      <circle cx="24" cy="35.5" r="2.3" className="fill-primary" />
      <circle cx="24" cy="40" r="2.3" className="fill-primary" />
    </svg>
  );
}

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