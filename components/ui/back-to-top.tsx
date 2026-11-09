"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "cn";

export function BackToTop() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Retour en haut"
      className={cn(
        "fixed bottom-6 right-6 z-40 flex size-11 items-center justify-center rounded-full",
        "border border-hairline bg-card/90 text-foreground shadow-lg backdrop-blur",
        "transition-all duration-300 hover:bg-primary hover:text-ink",
        "animate-in fade-in slide-in-from-bottom-4"
      )}
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </button>
  );
}
