import * as React from "react";
import Image from "next/image";
import { LayoutGrid, Mic, Power, Search, Sun, Volume2 } from "lucide-react";
import { cn } from "cn";

/**
 * L'ordinateur du hero, calqué sur la référence Montaaj (HTML/CSS analysés) :
 *   - conteneur `[perspective:800px]` ;
 *   - capot `rotateX(-25deg)` depuis `transform-origin: center bottom` ;
 *   - écran `scaleX(1.2) scaleY(0.6) rotateX(-28deg)` depuis `center top`,
 *     avec capture RÉELLE du produit en `object-cover object-left-top` ;
 *   - base de clavier à plat dessinée en pur CSS : charnière, grilles
 *     perforées, 78 touches (contour argent `bg-white/[0.2]`, touche
 *     `#0A090D` avec ombres internes), trackpad et lèvre avant.
 * Aucune parallaxe ni flottement : la référence est statique à l'écran
 * (seule l'apparition est animée, via `animate-rise` du hero).
 */

const KEY_INSET = {
  boxShadow: "rgb(13, 13, 15) 0px -0.5px 2px 0px inset, rgb(13, 13, 15) -0.5px 0px 2px 0px inset",
};

type KeyDef = {
  w?: string;
  label?: string;
  icon?: React.ReactNode;
  /** Touche moitié de hauteur (flèches haut/bas empilées). */
  half?: boolean;
  /** Libellé ancré en bas à gauche (esc). */
  corner?: boolean;
  /** Barre espace : occupe la largeur restante de la rangée. */
  grow?: boolean;
};

const F_ICONS: React.ReactNode[] = [
  <Sun key="f1" aria-hidden="true" />,
  <Sun key="f2" aria-hidden="true" />,
  <Search key="f3" aria-hidden="true" />,
  <LayoutGrid key="f4" aria-hidden="true" />,
  <Mic key="f5" aria-hidden="true" />,
  <Volume2 key="f6" aria-hidden="true" />,
];

const ROWS: KeyDef[][] = [
  // Function
  [
    { w: "w-10", label: "esc", corner: true },
    ...Array.from({ length: 12 }, (_, i) => ({
      label: `F${i + 1}`,
      icon: F_ICONS[i % F_ICONS.length],
    })),
    { icon: <Power aria-hidden="true" /> },
  ],
  // Chiffres
  [
    { label: "~" },
    ..."1234567890".split("").map((label) => ({ label })),
    { label: "-" },
    { label: "=" },
    { w: "w-10", label: "delete" },
  ],
  // AZERTY haut
  [
    { w: "w-8", label: "tab" },
    ..."AZERTYUIOP".split("").map((label) => ({ label })),
    { label: "^" },
    { label: "$" },
    { w: "w-9", label: "entrée" },
  ],
  // Home
  [
    { w: "w-9", label: "caps" },
    ..."QSDFGHJKL".split("").map((label) => ({ label })),
    { label: "ù" },
    { label: "*" },
    { w: "w-10", label: "" },
  ],
  // Bas
  [
    { w: "w-11", label: "shift" },
    { label: "<" },
    ..."WXCVBN".split("").map((label) => ({ label })),
    { label: "," },
    { label: ";" },
    { label: ":" },
    { label: "!" },
    { w: "w-10", label: "shift" },
  ],
  // Barre de commande
  [
    { w: "w-6", label: "fn" },
    { w: "w-6", label: "ctrl" },
    { w: "w-6", label: "opt" },
    { w: "w-8", label: "cmd" },
    { grow: true, label: "" },
    { w: "w-8", label: "cmd" },
    { w: "w-8", label: "option", icon: <OptionGlyph /> },
  ],
];

function Key({ w = "w-6", label, icon, half, corner, grow }: KeyDef & { grow?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[4px] bg-white/[0.2] p-[0.5px] shadow-xl shadow-white [transform:translateZ(0)] [will-change:transform]",
        grow && "flex-1"
      )}
    >
      <div
        className={cn(
          "flex h-6 items-center justify-center rounded-[3.5px] bg-[#0A090D] text-white",
          grow ? "w-full" : w,
          half && "h-3",
          corner && "items-end justify-start pb-[2px] pl-[4px]"
        )}
        style={KEY_INSET}
      >
        {icon ? (
          <span className="flex flex-col items-center justify-center gap-px text-[5px] leading-none">
            <span className="[&>svg]:h-[6px] [&>svg]:w-[6px]">{icon}</span>
            {label ? (
              <span className="flex w-full justify-start pl-1">
                <span className="block">{label}</span>
              </span>
            ) : null}
          </span>
        ) : label ? (
          <span className="flex w-full justify-start pl-1 text-[5px] leading-none">
            <span className="block">{label}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ArrowKey({ d }: { d: string }) {
  return (
    <div className="rounded-[4px] bg-white/[0.2] p-[0.5px] shadow-xl shadow-white [transform:translateZ(0)] [will-change:transform]">
      <div
        className="flex h-3 w-6 items-center justify-center rounded-[3.5px] bg-[#0A090D]"
        style={KEY_INSET}
      >
        <div className="flex w-full flex-col items-center justify-center text-[5px] text-white">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[6px] w-[6px]"
            aria-hidden="true"
          >
            <path d={d} />
          </svg>
        </div>
      </div>
    </div>
  );
}

function ArrowCluster() {
  return (
    <div className="mt-[2px] flex h-6 w-[4.9rem] flex-col items-center justify-end rounded-[4px] p-[0.5px]">
      <ArrowKey d="M12 6l6 8H6z" />
      <div className="flex">
        <ArrowKey d="M6 12l8-6v12z" />
        <ArrowKey d="M12 18l6-8H6z" />
        <ArrowKey d="M18 12l-8 6V6z" />
      </div>
    </div>
  );
}

function OptionGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="h-[6px] w-[6px]" aria-hidden="true">
      <rect stroke="currentColor" strokeWidth="2" x="18" y="5" width="10" height="2" />
      <polygon
        stroke="currentColor"
        strokeWidth="2"
        points="10.6,5 4,5 4,7 9.4,7 18.4,27 28,27 28,25 19.6,25"
      />
    </svg>
  );
}

export function HeroLaptop() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto mt-10 flex w-full max-w-4xl justify-center overflow-hidden pt-2 sm:mt-14"
    >
      <div
        className="animate-rise -mb-36 origin-top scale-[0.56] sm:-mb-20 sm:scale-[0.76] md:-mb-10 md:scale-90 lg:mb-0 lg:scale-100"
        style={{ "--rise-delay": "420ms" } as React.CSSProperties}
      >
        <div className="scene3d relative flex flex-col items-center [perspective:800px]">
        {/* Capot (dessous de l'écran) */}
        <div
          className="relative h-[12rem] w-[32rem] rounded-2xl bg-[#010101] p-2"
          style={{
            transform: "perspective(800px) rotateX(-25deg)",
            transformOrigin: "center bottom",
            transformStyle: "preserve-3d",
          }}
        >
          <div
            className="absolute inset-0 rounded-lg bg-[#010101]"
            style={{ boxShadow: "rgb(23, 23, 23) 0px 2px 0px 2px inset" }}
          />
        </div>
        {/* Écran : capture réelle de la marketplace */}
        <div
          className="absolute inset-x-0 top-0 h-80 w-[32rem] rounded-2xl bg-[#010101] p-2"
          style={{
            transform: "scaleX(1.2) scaleY(0.6) rotateX(-28deg)",
            transformOrigin: "center top",
            transformStyle: "preserve-3d",
          }}
        >
          <div className="absolute inset-0 rounded-lg bg-[#272729]" />
          <Image
            src="/hero/briefs-desktop.png"
            alt=""
            width={1280}
            height={800}
            priority
            sizes="(max-width: 768px) 100vw, 1280px"
            className="absolute inset-0 h-full w-full rounded-lg bg-black object-cover object-left-top"
          />
        </div>

        {/* Base : clavier plat, grilles et trackpad */}
        <div className="relative -z-10 h-[22rem] w-[32rem] overflow-hidden rounded-2xl bg-[#272729]">
          {/* Charnière */}
          <div className="relative h-10 w-full">
            <div className="absolute inset-x-0 mx-auto h-4 w-[80%] bg-[#050505]" />
          </div>
          {/* Grilles + clavier */}
          <div className="relative flex">
            <div className="mx-auto h-full w-[10%] overflow-hidden">
              <div
                className="mt-2 flex h-40 gap-[2px] px-[0.5px]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgb(8, 8, 10) 0.5px, transparent 0.5px)",
                  backgroundSize: "3px 3px",
                }}
              />
            </div>
            <div className="mx-auto h-full w-[80%]">
              <div className="mx-1 h-full rounded-md bg-[#050505] p-1">
                {ROWS.map((row, i) => (
                  <div
                    key={i}
                    className="mb-[2px] flex w-full shrink-0 gap-[2px]"
                  >
                    {row.map((key, j) => (
                      <Key key={j} {...key} />
                    ))}
                    {i === ROWS.length - 1 ? <ArrowCluster /> : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="mx-auto h-full w-[10%] overflow-hidden">
              <div
                className="mt-2 flex h-40 gap-[2px] px-[0.5px]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgb(8, 8, 10) 0.5px, transparent 0.5px)",
                  backgroundSize: "3px 3px",
                }}
              />
            </div>
          </div>
          {/* Trackpad */}
          <div
            className="mx-auto my-1 h-32 w-[40%] rounded-xl"
            style={{ boxShadow: "rgba(0, 0, 0, 0.125) 0px 0px 1px 1px inset" }}
          />
          {/* Lèvre avant */}
          <div className="absolute inset-x-0 bottom-0 mx-auto h-2 w-20 rounded-tl-3xl rounded-tr-3xl bg-gradient-to-t from-[#272729] to-[#050505]" />
        </div>
      </div>
      </div>
    </div>
  );
}
