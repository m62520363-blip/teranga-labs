"use client";

import * as React from "react";
import { BadgeCheck, Briefcase, Wallet } from "lucide-react";
import { Coin } from "@/components/landing/scene-3d";

/**
 * Orbite décorative du hero : mini tableau de bord, carte de brief
 * flottante, duo client/développeur et badge de vérification, posés en
 * profondeur (translateZ) autour de la carte réelle du brief.
 *
 * Tout est `aria-hidden` : la carte centrale reste la seule source
 * d'information. Parallax léger au pointeur (souris uniquement — le
 * tactile n'a pas de hover), neutralisé en prefers-reduced-motion.
 */

const TILT_MAX_DEG = 5;

export function HeroOrbit() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setTilt({ x: -ny * TILT_MAX_DEG, y: nx * TILT_MAX_DEG });
  }

  function onPointerLeave() {
    setTilt({ x: 0, y: 0 });
  }

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      aria-hidden="true"
      className="pointer-events-none absolute -inset-10 hidden select-none sm:block"
      style={{ perspective: "1000px" }}
    >
      <div
        className="relative h-full w-full transition-transform duration-500 ease-out will-change-transform [transform-style:preserve-3d]"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
      >
        <OrbitLayer x="2%" y="4%" z={-40}>
          <div className="w-44 rounded-2xl border border-hairline bg-card/95 p-3.5 shadow-[0_24px_60px_-22px_rgba(0,0,0,0.8)] backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Tableau de bord
            </p>
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-foreground">Briefs ouverts</span>
                <span className="text-[11px] font-bold text-primary">+3</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full w-3/4 rounded-full bg-gradient-to-r from-primary to-primary-light" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-foreground">Tokens</span>
                <span className="text-[11px] font-bold text-success">12</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full w-1/2 rounded-full bg-gradient-to-r from-success/80 to-success/30" />
              </div>
            </div>
          </div>
        </OrbitLayer>

        <OrbitLayer x="72%" y="-2%" z={70} delay={0.5}>
          <div className="w-48 rounded-2xl border border-hairline bg-card/95 p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <Briefcase className="size-3 text-primary" />
                E-commerce
              </span>
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold leading-snug tracking-tight text-foreground">
              Boutique wax · Abidjan
            </p>
            <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
              <Wallet className="size-2.5" />
              180 000 FCFA
            </span>
          </div>
        </OrbitLayer>

        <OrbitLayer x="82%" y="62%" z={90} delay={1}>
          <div className="flex items-center gap-2 rounded-full border border-hairline bg-card/95 py-2 pl-2 pr-4 shadow-[0_20px_48px_-18px_rgba(0,0,0,0.85)]">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-ink">
              C
            </span>
            <span className="h-px w-4 bg-gradient-to-r from-primary/60 to-primary/20" aria-hidden="true" />
            <span className="grid size-8 place-items-center rounded-full border border-hairline bg-muted text-xs font-bold text-foreground">
              D
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">Contact débloqué</span>
          </div>
        </OrbitLayer>

        <OrbitLayer x="-6%" y="58%" z={55} delay={1.5}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-card/95 px-3 py-1.5 text-[11px] font-semibold text-success shadow-lg shadow-black/40">
            <BadgeCheck className="size-3.5" />
            Profils vérifiés
          </span>
        </OrbitLayer>

        <OrbitLayer x="14%" y="88%" z={110} delay={0.8}>
          <Coin className="size-10" />
        </OrbitLayer>
      </div>
    </div>
  );
}

function OrbitLayer({
  x,
  y,
  z,
  delay = 0,
  children,
}: {
  x: string;
  y: string;
  z: number;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute" style={{ left: x, top: y, transform: `translateZ(${z}px)` }}>
      {/* Le flottement vit sur un calque interne : il ne doit pas écraser
          le translateZ (tl-float anime `transform`). */}
      <div className="tl-float" style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    </div>
  );
}
