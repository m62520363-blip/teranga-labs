import type { Metadata } from "next"
import { Crown, Trophy, UserRound } from "lucide-react"
import { LEADERBOARD_CONFIG } from "@/lib/leaderboard-config"
import { COUNTRIES } from "@/lib/countries"
import { Flag } from "@/components/ui/Flag"
import { Section, SectionHeader } from "@/components/landing/section"
import { Reveal } from "@/components/reveal"

export const metadata: Metadata = {
  title: "Classement des développeurs",
  description:
    "Classement mensuel des développeurs d'Afrique de l'Ouest francophone : classement régional et par pays. Seuls le 1er et le 2e recoivent des Tokens.",
}

const EMPTY_REGIONAL = "Aucun classement pour le mois en cours."

function RewardsLegend({
  rewards,
  scope,
}: {
  rewards: { 1?: number; 2?: number }
  scope: string
}) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span className="badge badge-success">
        1<sup>er</sup> {rewards[1] ?? 0} Tokens
      </span>
      <span className="badge badge-muted">
        2{<sup>e</sup>} {rewards[2] ?? 0} Tokens
      </span>
      <span className="text-xs">Autres rangs : 0 Token — {scope}</span>
    </p>
  )
}

function EmptyRow({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={5} className="px-4 py-10 text-center sm:px-6">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <UserRound className="size-4 text-primary" aria-hidden="true" />
          {label}
        </span>
      </td>
    </tr>
  )
}

const HEADERS = ["Rang", "Développeur", "Projets terminés (mois)", "Tokens attribués", "Badges"]

export default function ClassementPage() {
  const rewardRegional = LEADERBOARD_CONFIG.rewards.regional
  const rewardCountry = LEADERBOARD_CONFIG.rewards.country
  const enabled = LEADERBOARD_CONFIG.enabled

  return (
    <div className="bg-background">
      <Section ariaLabel="Classement des développeurs">
        <SectionHeader
          eyebrow="Classement mensuel"
          title="Le classement des développeurs"
          lead="Chaque mois, le classement régional (Afrique de l'Ouest francophone) et le classement de chaque pays récompensent les développeurs les plus actifs. Attribution automatique et idempotente au snapshot de fin de mois."
        />

        {!enabled && (
          <p className="mx-auto mt-6 max-w-xl rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-center text-xs text-warning">
            Récompenses désactivées via la configuration (LEADERBOARD_REWARD_ENABLED=false).
          </p>
        )}

        <Reveal className="mt-12">
          <div className="card mx-auto max-w-3xl p-7 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
              <Trophy className="size-6 text-primary" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-lg font-semibold tracking-tight">
              Le classement démarre bientôt
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Pour apparaître, un développeur doit avoir au moins{" "}
              <strong className="text-foreground">
                {LEADERBOARD_CONFIG.minProjectsToAppear} projets terminés et confirmés
              </strong>{" "}
              sur le mois concerné. Régional comme par pays, seuls les 2 premiers sont
              récompensés.
            </p>
            <RewardsLegend rewards={rewardRegional} scope="classement régional (Afrique de l'Ouest francophone)" />
          </div>
        </Reveal>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Classement régional (Afrique de l&apos;Ouest francophone)
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Période en cours — en attente de données suffisantes
              </p>
            </div>
            <span className="chip gap-2 bg-card/85 border-hairline backdrop-blur">
              <Crown className="size-3.5 text-primary" aria-hidden="true" />
              Top 2 récompensé
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-hairline bg-card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-hairline text-sm">
                <thead>
                  <tr className="bg-surface">
                    {HEADERS.map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:px-6"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  <EmptyRow label={EMPTY_REGIONAL} />
                </tbody>
              </table>
            </div>
          </div>

          <RewardsLegend rewards={rewardRegional} scope="classement régional (Afrique de l'Ouest francophone)" />
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Classement par pays
            </h2>
            <p className="text-sm text-muted-foreground">
              Période en cours — en attente de données suffisantes
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {COUNTRIES.map((c, index) => (
              <Reveal key={c.code} delay={(index % 3) as 0 | 1 | 2}>
                <div className="overflow-hidden rounded-2xl border border-hairline bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-3.5 sm:px-6">
                    <div className="flex items-center gap-2.5">
                      <Flag countryCode={c.code} size={20} />
                      <h3 className="text-sm font-semibold tracking-tight">{c.nameFr}</h3>
                      <span className="badge badge-muted">{c.currencyLabel}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      1{<sup>er</sup>} {rewardCountry[1] ?? 0} • 2{<sup>e</sup>}{" "}
                      {rewardCountry[2] ?? 0} • Autres 0
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-hairline text-sm">
                      <thead>
                        <tr>
                          {HEADERS.map((header) => (
                            <th
                              key={header}
                              scope="col"
                              className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:px-6"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        <EmptyRow label={`Aucune donnée pour ${c.nameFr} ce mois-ci.`} />
                      </tbody>
                    </table>
                  </div>

                  {c.notes && (
                    <p className="border-t border-hairline px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
                      {c.notes}
                    </p>
                  )}
                </div>
              </Reveal>
            ))}
          </div>

          <RewardsLegend rewards={rewardCountry} scope="classement par pays" />
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Palmarès des mois précédents
          </h2>
          <div className="mt-5 rounded-2xl border border-hairline bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun historique disponible pour le moment.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              L&apos;historique apparaîtra après le premier snapshot mensuel.
            </p>
          </div>
        </section>

        <p className="mt-12 border-t border-hairline pt-6 text-xs leading-relaxed text-muted-foreground">
          Critère d&apos;apparition : au moins 2 projets terminés et confirmés par mois. Seuls
          les 2 premiers (régional + par pays) reçoivent des Tokens ; les badges et la mise en
          avant restent conservés.
        </p>
      </Section>
    </div>
  )
}
