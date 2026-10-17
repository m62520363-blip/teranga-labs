"use client";

import * as React from "react";
import { cn } from "cn";

/** Rotation de mots en sérif italique (accent du hero, façon Montaaj). */
export function RotatingWords({
  words,
  intervalMs = 2600,
  className,
}: {
  words: readonly string[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (words.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [words.length, intervalMs]);

  return (
    <span className={cn("relative inline-grid text-left", className)}>
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden="true"
          className={cn(
            "col-start-1 row-start-1 font-serif-display font-normal italic tracking-normal text-primary transition-all duration-500 [transition-timing-function:var(--ease-spring)]",
            i === index
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-[0.25em] pointer-events-none"
          )}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
