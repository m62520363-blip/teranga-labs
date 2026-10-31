"use client";

import * as React from "react";
import { cn } from "cn";

/**
 * Scène 3D légère pour les pages d'atterrissage.
 *
 * Réalise une vraie profondeur (perspective + translateZ) et un parallax
 * piloté par le pointeur, sans dépendance : ni three.js ni WebGL, donc
 * aucun coût de bundle et aucun impact sur le LCP. Les objets flottants
 * réutilisent les keyframes natives du site (tl-float, tl-drift) et
 * s'arrêtent avec prefers-reduced-motion via globals.css.
 */

export type SceneVariant = "marketplace" | "tokens" | "brief" | "team" | "ranking";

const TILT_MAX_DEG = 9;

export function Scene3D({
  variant,
  className,
  label,
}: {
  variant: SceneVariant;
  className?: string;
  label?: string;
}) {
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
      className={cn("scene3d relative mx-auto w-full max-w-md select-none", className)}
      style={{ perspective: "1200px" }}
      aria-hidden={label ? undefined : "true"}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <div
        className="relative h-[380px] w-full transition-transform duration-500 ease-out will-change-transform [transform-style:preserve-3d]"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        {variant === "marketplace" ? <MarketplaceScene /> : null}
        {variant === "tokens" ? <SubscriptionScene /> : null}
        {variant === "brief" ? <BriefScene /> : null}
        {variant === "team" ? <TeamScene /> : null}
        {variant === "ranking" ? <RankingScene /> : null}
      </div>
    </div>
  );
}

/* ------------------------------- Primitives ------------------------------- */

function Layer({
  z,
  x = "50%",
  y = "50%",
  delay = 0,
  float = true,
  className,
  children,
}: {
  z: number;
  x?: string;
  y?: string;
  delay?: number;
  float?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("absolute", float && "tl-float", className)}
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, -50%) translateZ(${z}px)`,
        animationDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/** Pièce 3D décorative, réutilisable hors des scènes (hero, CTA…). */
export function Coin({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-14 place-items-center rounded-full",
        "bg-[radial-gradient(circle_at_32%_28%,#d5ffe8,#39FF88_58%,#0e7a46)]",
        "shadow-[0_16px_34px_-12px_rgba(57,255,136,0.65),inset_0_-3px_8px_rgba(0,0,0,0.35),inset_0_3px_6px_rgba(255,255,255,0.35)]",
        "ring-2 ring-[#ffbd7a]/50",
        className,
      )}
    >
      <span className="font-display text-lg font-extrabold text-[#5b2508]">T</span>
    </span>
  );
}

function CodeWindow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-56 rounded-2xl border border-white/10 bg-[#141019]/95 p-3 shadow-[0_30px_70px_-24px_rgba(0,0,0,0.85)] backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[#ff5f57]" />
        <span className="size-2 rounded-full bg-[#febc2e]" />
        <span className="size-2 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          brief.tsx
        </span>
      </div>
      <div className="mt-3 space-y-2" aria-hidden="true">
        <span className="block h-2 w-4/5 rounded-full bg-gradient-to-r from-primary/80 to-primary/10" />
        <span className="block h-2 w-3/5 rounded-full bg-muted-foreground/25" />
        <span className="block h-2 w-4/6 rounded-full bg-muted-foreground/20" />
        <span className="block h-2 w-2/4 rounded-full bg-primary/40" />
        <span className="inline-block h-3 w-[7px] animate-pulse rounded-sm bg-primary align-middle" />
      </div>
    </div>
  );
}

function Bubble({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-[190px] rounded-2xl border border-hairline bg-card px-4 py-3 text-xs font-medium leading-relaxed text-foreground shadow-[0_18px_44px_-18px_rgba(0,0,0,0.7)]",
        align === "right" && "rounded-br-md",
        align === "left" && "rounded-bl-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Pin({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 place-items-center rounded-full rounded-bl-none rotate-[-45deg]",
        "bg-primary shadow-[0_12px_26px_-8px_rgba(57,255,136,0.7)]",
        className,
      )}
    >
      <span className="size-3.5 rotate-45 rounded-full bg-ink" />
    </span>
  );
}

/* -------------------------------- Variants -------------------------------- */

function MarketplaceScene() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-2 bottom-4 top-10 rounded-[2.5rem] border border-white/[0.07] bg-[radial-gradient(120%_120%_at_50%_0%,rgba(57,255,136,0.14),transparent_60%)]"
        style={{ transform: "translateZ(-80px)" }}
      />
      <Layer z={-30} x="50%" y="46%" float={false}>
        <CodeWindow />
      </Layer>
      <Layer z={70} x="22%" y="24%" delay={0.4}>
        <Coin className="size-12" />
      </Layer>
      <Layer z={110} x="78%" y="30%" delay={1.1}>
        <Bubble align="right">
          <span className="text-primary">Client</span> · Site e-commerce à Dakar
        </Bubble>
      </Layer>
      <Layer z={50} x="30%" y="82%" delay={1.7}>
        <Bubble>
          <span className="text-primary">Dev</span> · Dispo cette semaine
        </Bubble>
      </Layer>
      <Layer z={140} x="82%" y="76%" delay={0.8}>
        <span className="rounded-full bg-foreground px-3.5 py-2 text-[11px] font-semibold text-ink shadow-xl shadow-black/40">
          Contact débloqué
        </span>
      </Layer>
    </>
  );
}

function SubscriptionScene() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-6 bottom-6 top-16 rounded-full border border-primary/15 bg-[radial-gradient(closest-side,rgba(57,255,136,0.16),transparent)]"
        style={{ transform: "translateZ(-60px) rotateX(62deg)" }}
      />
      <Layer z={40} x="50%" y="62%" float={false}>
        <div className="flex flex-col items-center gap-1.5">
          <Coin className="size-16" />
          <Coin className="size-16 -mt-8" />
          <Coin className="size-16 -mt-8" />
        </div>
      </Layer>
      <Layer z={120} x="24%" y="26%" delay={0.6}>
        <Coin className="size-10" />
      </Layer>
      <Layer z={90} x="78%" y="22%" delay={1.2}>
        <Coin className="size-8" />
      </Layer>
      <Layer z={150} x="72%" y="70%" delay={1.8}>
        <span className="rounded-full border border-hairline bg-card px-3.5 py-2 text-[11px] font-semibold shadow-lg shadow-black/40">
          Quota mensuel inclus
        </span>
      </Layer>
      <Layer z={100} x="26%" y="74%" delay={0.2}>
        <span className="rounded-full bg-foreground px-3.5 py-2 text-[11px] font-semibold text-ink shadow-xl shadow-black/40">
          0 % de commission
        </span>
      </Layer>
    </>
  );
}

function BriefScene() {
  return (
    <>
      <Layer z={-20} x="50%" y="48%" float={false}>
        <div className="w-52 rounded-2xl border border-hairline bg-card p-5 shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Nouveau brief
            </span>
            <span className="size-2 animate-ping rounded-full bg-success" />
          </div>
          <p className="mt-3 text-sm font-semibold leading-snug tracking-tight">
            Boutique en ligne · Abidjan
          </p>
          <div className="mt-3 space-y-1.5" aria-hidden="true">
            <span className="block h-1.5 w-full rounded-full bg-muted-foreground/20" />
            <span className="block h-1.5 w-3/4 rounded-full bg-muted-foreground/15" />
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary">
            Budget 350 000 FCFA
          </div>
        </div>
      </Layer>
      <Layer z={80} x="78%" y="22%" delay={0.7}>
        <span className="grid size-12 place-items-center rounded-2xl border border-hairline bg-card shadow-lg shadow-black/40">
          <span className="font-mono text-lg text-primary">&lt;/&gt;</span>
        </span>
      </Layer>
      <Layer z={130} x="22%" y="30%" delay={1.3}>
        <Coin className="size-11" />
      </Layer>
      <Layer z={110} x="70%" y="78%" delay={1.9}>
        <span className="rounded-full bg-foreground px-3.5 py-2 text-[11px] font-semibold text-ink shadow-xl shadow-black/40">
          Publié en 2 minutes
        </span>
      </Layer>
    </>
  );
}

function TeamScene() {
  return (
    <>
      <Layer z={-40} x="50%" y="52%" float={false}>
        <div className="flex items-end gap-2.5">
          {[44, 64, 52].map((h) => (
            <span
              key={h}
              className="w-11 rounded-t-xl border border-hairline bg-gradient-to-b from-card to-muted"
              style={{ height: h }}
              aria-hidden="true"
            />
          ))}
        </div>
      </Layer>
      <Layer z={60} x="28%" y="26%" delay={0.5}>
        <span className="grid size-12 place-items-center rounded-full border border-hairline bg-card text-sm font-bold shadow-lg shadow-black/40">
          A
        </span>
      </Layer>
      <Layer z={90} x="72%" y="20%" delay={1.1}>
        <span className="grid size-10 place-items-center rounded-full border border-hairline bg-card text-sm font-bold shadow-lg shadow-black/40">
          M
        </span>
      </Layer>
      <Layer z={130} x="50%" y="80%" delay={1.6}>
        <span className="rounded-full bg-foreground px-3.5 py-2 text-[11px] font-semibold text-ink shadow-xl shadow-black/40">
          Équipe vérifiée · Dakar
        </span>
      </Layer>
      <Layer z={100} x="82%" y="66%" delay={0.3}>
        <Pin />
      </Layer>
    </>
  );
}

function RankingScene() {
  return (
    <>
      <Layer z={-30} x="50%" y="66%" float={false}>
        <div className="flex items-end gap-2">
          <span className="h-14 w-14 rounded-t-lg border border-hairline bg-card/90" />
          <span className="h-20 w-14 rounded-t-lg border border-primary/40 bg-gradient-to-b from-primary/30 to-card" />
          <span className="h-11 w-14 rounded-t-lg border border-hairline bg-card/90" />
        </div>
      </Layer>
      <Layer z={120} x="50%" y="26%" delay={0.4}>
        <span className="grid size-14 place-items-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#d9ffe9,#39FF88_60%,#0e7a46)] font-display text-xl font-extrabold text-[#0b3b22] shadow-[0_18px_40px_-14px_rgba(57,255,136,0.7)]">
          1
        </span>
      </Layer>
      <Layer z={80} x="20%" y="48%" delay={1}>
        <span className="grid size-10 place-items-center rounded-full border border-hairline bg-card text-sm font-bold shadow-lg shadow-black/40">
          2
        </span>
      </Layer>
      <Layer z={70} x="82%" y="52%" delay={1.5}>
        <span className="grid size-9 place-items-center rounded-full border border-hairline bg-card text-xs font-bold shadow-lg shadow-black/40">
          3
        </span>
      </Layer>
      <Layer z={150} x="76%" y="16%" delay={2}>
        <span className="rounded-full bg-foreground px-3.5 py-2 text-[11px] font-semibold text-ink shadow-xl shadow-black/40">
          Top du mois
        </span>
      </Layer>
    </>
  );
}
