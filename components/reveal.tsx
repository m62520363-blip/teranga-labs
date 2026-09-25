"use client";

import * as React from "react";
import { cn } from "cn";

export function Reveal({
  children,
  className,
  delay,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: 0 | 1 | 2 | 3 | 4;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      node.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "tl-reveal",
        delay === 1 && "tl-reveal-delay-1",
        delay === 2 && "tl-reveal-delay-2",
        delay === 3 && "tl-reveal-delay-3",
        delay === 4 && "tl-reveal-delay-4",
        className
      )}
    >
      {children}
    </div>
  );
}