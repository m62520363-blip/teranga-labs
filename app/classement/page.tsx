import { Metadata } from "next"
import { LEADERBOARD_CONFIG } from "@/lib/leaderboard-config"
import { COUNTRIES } from "@/lib/countries"
import { Flag } from "@/components/ui/Flag"

export const metadata: Metadata = {
  title: "Classement | TERANGA LABS",
  description: "Classement mensuel des developpeurs — Afrique de l&apos;Ouest francophone (UEMOA). Seuls le 1er et le 2e recoivent des Tokens.",
}

export default function ClassementPage() {
  const rewardRegional = LEADERBOARD_CONFIG.rewards.regional
  const rewardCountry = LEADERBOARD_CONFIG.rewards.country
  const enabled = LEADERBOARD_CONFIG.enabled

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Classement des developpeurs</h1>
          <p className="mt-2 text-sm text-gray-600">
            Afrique de l&apos;Ouest francophone (UEMOA) — Classement mensuel (regional + par pays). Attribution automatique et
            idempotente au snapshot de fin de mois.
          </p>
          {!enabled && (
            <p className="mt-2 text-xs text-amber-700">
              Recompenses desactivees via configuration (LEADERBOARD_REWARD_ENABLED=false).
            </p>
          )}
        </div>

        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-sm font-semibold text-blue-900">Le classement demarre bientot</h2>
          <p className="mt-1 text-xs text-blue-800">
            Pour apparaitre au classement, un developpeur doit avoir au moins 2 projets termines et confirmes au cours du
            mois concerne. Seuls le <strong>1er</strong> ({rewardRegional[1] ?? 0} Tokens) et le <strong>2e</strong> (
            {rewardRegional[2] ?? 0} Tokens) recoivent des Tokens (regional + par pays).
          </p>
        </div>

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Classement regional (UEMOA)</h2>
            <span className="text-xs text-gray-500">Periode en cours — en attente de donnees suffisantes</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Rang</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Developpeur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Projets termines (mois)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Tokens attribues</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Badges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 sm:px-6">Aucune donnee pour le mois en cours.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Recompenses regionales : 1er {rewardRegional[1] ?? 0} Tokens • 2e {rewardRegional[2] ?? 0} Tokens • Autres 0.
          </p>
        </section>

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Classement par pays</h2>
            <span className="text-xs text-gray-500">Periode en cours — en attente de donnees suffisantes</span>
          </div>
          <div className="space-y-6">
            {COUNTRIES.map((c) => (
              <div key={c.code} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-2">
                    <Flag countryCode={c.code} size={20} />
                    <h3 className="text-sm font-semibold text-gray-900">{c.nameFr}</h3>
                    <span className="text-xs text-gray-500">({c.currencyLabel})</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    1er {rewardCountry[1] ?? 0} • 2e {rewardCountry[2] ?? 0} • Autres 0
                  </span>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Rang</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Developpeur</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Projets termines (mois)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Tokens</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Badges</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-xs text-gray-500 sm:px-6">Aucune donnee pour ce pays ce mois-ci.</td>
                    </tr>
                  </tbody>
                </table>
                {c.notes && <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 sm:px-6">{c.notes}</p>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Recompenses par pays : 1er {rewardCountry[1] ?? 0} Tokens • 2e {rewardCountry[2] ?? 0} Tokens • Autres 0.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Palmares des mois precedents</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm text-gray-500">Aucun historique disponible pour le moment.</p>
            <p className="mt-1 text-xs text-gray-400">
              L&apos;historique apparaîtra apres le premier snapshot mensuel (attribution idempotente).
            </p>
          </div>
        </section>

        <div className="mt-8 text-xs text-gray-500">
          Critere d&apos;apparition : ≥ 2 projets termines et confirmes par mois. Seuls les 2 premiers (regional + par pays)
          recoivent des Tokens. Badges, mise en avant et certificat conserves.
        </div>
      </div>
    </div>
  )
}
