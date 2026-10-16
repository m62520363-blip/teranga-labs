import { COUNTRIES } from "@/lib/countries";

/**
 * Carte stylisée de l'Afrique de l'Ouest francophone, en SVG inline pour
 * pouvoir animer les connexions entre villes (dashflow) et les halos des
 * pins (pulse) — un <img> ne permet pas de styler l'intérieur.
 *
 * Les positions sont abstraites (grille de points) mais respectent
 * l'orientation réelle : Dakar à l'ouest, Niamey au nord-est, la côte
 * Abidjan → Cotonou → Lomé au sud. Aucune ville hors périmètre
 * (les 9 pays de `lib/countries.ts`).
 */

const CITIES = {
  dakar: { x: 122, y: 158 },
  bissau: { x: 152, y: 186 },
  conakry: { x: 176, y: 202 },
  bamako: { x: 214, y: 152 },
  ouaga: { x: 264, y: 170 },
  niamey: { x: 302, y: 136 },
  abidjan: { x: 242, y: 236 },
  cotonou: { x: 286, y: 224 },
  lome: { x: 308, y: 230 },
} as const;

const LINKS: { d: string; delay: number }[] = [
  { d: "M122,158 Q168,132 214,152", delay: 0 },
  { d: "M214,152 Q240,150 264,170", delay: 0.4 },
  { d: "M264,170 Q286,146 302,136", delay: 0.8 },
  { d: "M122,158 Q148,178 176,202", delay: 0.6 },
  { d: "M176,202 Q210,214 242,236", delay: 1 },
  { d: "M242,236 Q264,224 286,224", delay: 1.2 },
  { d: "M286,224 L308,230", delay: 1.4 },
];

function Pin({
  x,
  y,
  label,
  labelSide = "right",
  main = false,
  delay = 0,
}: {
  x: number;
  y: number;
  label: string;
  labelSide?: "left" | "right" | "top";
  main?: boolean;
  delay?: number;
}) {
  const r = main ? 8 : 6;
  const labelX = labelSide === "left" ? x - r - 6 : labelSide === "top" ? x : x + r + 6;
  const labelY = labelSide === "top" ? y - r - 8 : y + 4;
  return (
    <g>
      {main ? (
        <circle
          cx={x}
          cy={y}
          r={r}
          fill="#e86a2c"
          className="tl-pulse-ring"
          style={{ animationDelay: `${delay}s` }}
        />
      ) : null}
      <circle cx={x} cy={y} r={r} fill="#e86a2c" opacity={main ? 1 : 0.8} />
      <circle cx={x} cy={y} r={main ? 3.2 : 2.4} fill="#0d0d0d" />
      <text
        x={labelX}
        y={labelY}
        textAnchor={labelSide === "left" ? "end" : labelSide === "top" ? "middle" : "start"}
        fontFamily="system-ui,sans-serif"
        fontSize={main ? 12 : 10}
        fontWeight={main ? 700 : 600}
        fill={main ? "#f2f2f2" : "#9a9a9a"}
      >
        {label}
      </text>
    </g>
  );
}

export function WestAfricaMap() {
  const regionCount = COUNTRIES.reduce((n, c) => n + c.regions.length, 0);
  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-hairline">
      <svg
        data-testid="west-africa-map"
        viewBox="0 0 480 360"
        fill="none"
        role="img"
        aria-label="Carte stylisée de l'Afrique de l'Ouest francophone : Dakar, Bissau, Conakry, Bamako, Ouagadougou, Niamey, Abidjan, Cotonou et Lomé reliés par le réseau TERANGA LABS"
        className="block h-auto w-full"
      >
        <rect width="480" height="360" rx="24" fill="#0f0f0f" />
        {/* Grille de points (carte abstraite) */}
        <g fill="#2a2a2a">
          <circle cx="120" cy="120" r="4" /><circle cx="148" cy="112" r="4" /><circle cx="176" cy="106" r="4" /><circle cx="204" cy="104" r="4" /><circle cx="232" cy="108" r="4" />
          <circle cx="112" cy="148" r="4" /><circle cx="140" cy="140" r="4" /><circle cx="168" cy="134" r="4" /><circle cx="196" cy="132" r="4" /><circle cx="224" cy="136" r="4" /><circle cx="252" cy="144" r="4" /><circle cx="280" cy="152" r="4" />
          <circle cx="116" cy="176" r="4" /><circle cx="144" cy="168" r="4" /><circle cx="172" cy="162" r="4" /><circle cx="200" cy="160" r="4" /><circle cx="228" cy="164" r="4" /><circle cx="256" cy="172" r="4" /><circle cx="284" cy="180" r="4" /><circle cx="312" cy="188" r="4" />
          <circle cx="128" cy="204" r="4" /><circle cx="156" cy="196" r="4" /><circle cx="184" cy="190" r="4" /><circle cx="212" cy="188" r="4" /><circle cx="240" cy="192" r="4" /><circle cx="268" cy="200" r="4" /><circle cx="296" cy="208" r="4" />
          <circle cx="148" cy="232" r="4" /><circle cx="176" cy="224" r="4" /><circle cx="204" cy="220" r="4" /><circle cx="232" cy="224" r="4" /><circle cx="260" cy="232" r="4" /><circle cx="288" cy="240" r="4" />
          <circle cx="176" cy="256" r="4" /><circle cx="204" cy="252" r="4" /><circle cx="232" cy="256" r="4" /><circle cx="260" cy="264" r="4" />
        </g>

        {/* Connexions vivantes entre les villes desservies */}
        <g stroke="#e86a2c" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" fill="none">
          {LINKS.map((link) => (
            <path
              key={link.d}
              d={link.d}
              className="tl-dash-flow"
              style={{ animationDelay: `${link.delay}s` }}
            />
          ))}
        </g>

        {/* Villes : capitales commerciales des 9 pays du périmètre */}
        <Pin x={CITIES.dakar.x} y={CITIES.dakar.y} label="Dakar" labelSide="top" main delay={0} />
        <Pin x={CITIES.bissau.x} y={CITIES.bissau.y} label="Bissau" labelSide="left" delay={0.3} />
        <Pin x={CITIES.conakry.x} y={CITIES.conakry.y} label="Conakry" labelSide="left" delay={0.6} />
        <Pin x={CITIES.bamako.x} y={CITIES.bamako.y} label="Bamako" delay={0.9} />
        <Pin x={CITIES.ouaga.x} y={CITIES.ouaga.y} label="Ouagadougou" labelSide="top" main delay={1.2} />
        <Pin x={CITIES.niamey.x} y={CITIES.niamey.y} label="Niamey" delay={1.5} />
        <Pin x={CITIES.abidjan.x} y={CITIES.abidjan.y} label="Abidjan" main delay={1.8} />
        <Pin x={CITIES.cotonou.x} y={CITIES.cotonou.y} label="Cotonou" delay={2.1} />
        <Pin x={CITIES.lome.x} y={CITIES.lome.y} label="Lomé" delay={2.4} />

        <text
          x="240"
          y="332"
          textAnchor="middle"
          fontFamily="system-ui,sans-serif"
          fontSize="13"
          fontWeight="600"
          fill="#9a9a9a"
        >
          {COUNTRIES.length} pays · {regionCount} régions · une seule plateforme
        </text>
      </svg>
    </div>
  );
}
