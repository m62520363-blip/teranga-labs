import type { ReactNode } from "react";
import { cn } from "cn";

export function Eyebrow({
  children,
  className,
  tone = "light",
}: {
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
        tone === "light"
          ? "border border-hairline bg-[#141414] text-muted-foreground"
          : "border border-white/15 bg-[#FFFFFF]/8 text-white/80 backdrop-blur",
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
      {children}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  lead,
  align = "center",
  tone = "light",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left";
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className
      )}
    >
      {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
      <h2
        className={cn(
          "mt-5 text-3xl font-semibold leading-[1.12] tracking-tight sm:text-4xl md:text-[42px]",
          tone === "dark" && "text-white"
        )}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={cn(
            "mt-5 text-base leading-relaxed sm:text-lg",
            tone === "dark" ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

export function Section({
  id,
  className,
  children,
  ariaLabel,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <section
      id={id}
      className={cn("container-tl py-20 md:py-28", className)}
      aria-label={ariaLabel}
    >
      {children}
    </section>
  );
}