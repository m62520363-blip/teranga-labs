# TERANGA LABS

**Des clients qui veulent un site. Tous les jours au Sénégal.**

Marketplace inversé SaaS : les entreprises et entrepreneurs sénégalais publient
gratuitement leur besoin de site web ; les développeurs utilisent **1 Token**
pour débloquer le contact WhatsApp du client.

## Stack

- **Next.js 15** (App Router, React 19, TypeScript, Turbopack)
- **Tailwind CSS v4** + shadcn/ui (style « base-nova », @base-ui/react)
- **Supabase** : auth (email), Postgres, RLS, fonctions RPC
- **react-hook-form + zod**, **sonner** (toasts), **lucide-react**

## Structure

```
app/
  (page.tsx)        Landing : Hero, Problème, Comment ça marche, Briefs, Tokens, FAQ
  poster/           Publier un brief (gratuit)
  briefs/           Annuaire des briefs + filtres + déblocage
  tokens/           Packs de Tokens (paiement à venir)
  login/ signup/    Auth développeur
  dashboard/        Solde, déblocages, profil
  admin/            Pilotage admin (briefs, développeurs, transactions)
  auth/confirm      Échange du code de confirmation
  auth/update-password
components/         UI métier (unlock-dialog, brief-filters, admin-dashboard…)
lib/supabase/       clients browser/server null-safe
scripts/            db-test.mjs (runner pgtap)
supabase/
  migrations/       31 migrations SQL (0001 → 0031)
  tests/            tests pgtap (permissions.sql, reviews.sql)
  config.toml       stack locale (supabase start / supabase test db)
```

## Configuration locale

```bash
npm install
cp .env.example .env.local   # renseigner NEXT_PUBLIC_SUPABASE_URL / SERVICE KEY
npm run dev                  # http://localhost:3000
```

### Supabase (production)

1. Créer un projet Supabase.
2. Exécuter **toutes** les migrations dans l'ordre : `supabase/migrations/*.sql`
   (`0001_initial_schema.sql` → `0031_security_hardening.sql`).
3. Insérer les données de démo : `supabase/seed.sql` (6 briefs).
4. Configurer **Auth → URL : http://localhost:3000** et le redirect à `/auth/confirm`.

> Sans `.env.local` renseigné, l'app tourne en « mode démo » (aucun appel Supabase).

> **Après toute migration** : `npm run test:db` valide en base (voir Tests).

## Modèle de sécurité

- **RLS** : les briefs sont lisibles par tous mais `client_whatsapp` n'est pas
  sélectionnable via l'API REST (column-level grants).
- **RPC `security definer`** : tout accès privilégié passe par
  `unlock_request`, `get_my_unlocks`, `get_my_role`, `get_token_balance`,
  `get_admin_stats`, `admin_list_*`, `admin_update_request`, `credit_tokens`.
- **1 Token = 1 contact** : `unlock_request` est atomique (débit + insert
  `unlocks` avec unique `(developer_id, request_id)`, jamais deux fois).
- **Admin** : `user_roles.role = 'admin'` + `is_admin()`. La page `/admin`
  vérifie le rôle côté serveur.
- **Avis clients** : `submit_review` n'accepte que le propriétaire d'une mission
  **terminée** (SQLSTATE `TLFOR` / `TLTMP`), un avis par mission (upsert), et
  toute réponse publique est notée sans jamais pouvoir modifier la note.
- **Surface SQL figée** : seules 19 fonctions de `public` sont atteignables par
  un visiteur non connecté (briefs, avis publics, annuaire, formulaire de
  contact). Tout le reste exige une session ou `service_role`.
- ⚠️ **PostgreSQL** : une fonction hérite d'EXECUTE via `PUBLIC`. `revoke …
  from anon` seul ne protège donc rien — chaque révocation porte aussi sur
  `PUBLIC` (cf. migration 0031). Ce piège avait laissé 88 fonctions
  (dont `notify_user` et toutes les `admin_*`) exécutables par un visiteur.
- Création automatique du profil développeur via le trigger `handle_new_user`.

Ces règles sont **testées**, pas seulement documentées : voir
`supabase/tests/permissions.sql`.

## Design system

Toutes les couleurs passent par les tokens de `app/globals.css` — plus aucune
valeur hexadécimale en dur dans les composants.

| Token | Valeur | Rôle |
| --- | --- | --- |
| `--primary` | `#e86a2c` | orange TERANGA (boutons, liens, accents) |
| `--primary-foreground` | `--ink` `#0d0d0d` | texte **sur** un aplat orange |
| `--ink` | `#0d0d0d` | texte sur fond clair (secondaires inversés) |
| `--hairline` | `#2a2a2a` | filet de séparation des cartes |
| `--border` | `#262626` | bordure de champ et de carte |
| `--surface` / `--surface-secondary` | `#0f0f0f` / `#141414` | fond de section et de carte |

Les teintes translucides (`--accent-glow`, `--*-soft`) sont exprimées en
`color-mix()` sur ces tokens : plus de `rgba()` à dupliquer.

> **Contraste** : le texte posé sur un aplat de marque est le noir, pas le
> blanc. `#0d0d0d` sur `#e86a2c` = **6.04:1** (WCAG AA) alors que `#ffffff`
> sur la même couleur plafonne à **3.22:1** et échoue. Toute la surface —
> `.btn-primary`, `<Button>`, `<Badge>`, boutons de formulaire, badges —
> passe par `--primary-foreground`, donc le choix correct est appliqué une
> seule fois. Le reste de la palette est vérifié : texte principal 17.7:1,
> texte secondaire 7.9:1, succès 10.3:1, warning 11.9:1, erreur 5.1:1.

> Ajouter une couleur = ajouter un token dans `:root` **et** son alias
> `--color-*` dans `@theme inline`, puis n'utiliser que l'utilitaire
> (`bg-primary`, `text-ink`, `border-hairline`). Ne jamais réintroduire de
> hexadécimal dans un composant.

## Économie des Tokens

- `token_transactions` : `amount` (positif = crédit, négatif = débit),
  `amount_fcfa` (paiement réel éventuel), `type` ∈ `purchase` / `bonus` /
  `unlock`, `request_id` pour tracer le déblocage.
- **Aucun paiement simulé** : le bouton d'achat affiche « Paiement bientôt
  disponible ». Le crédit est administrable via `/admin` (`credit_tokens`).

## Tests

Trois niveaux, tous exécutés automatiquement par `.github/workflows/ci.yml` :

```bash
npm run check     # typecheck + lint + tests unitaires (68)
npm run test:db   # tests pgtap sur la base (69 assertions)
npm run build     # build de production
```

### Tests SQL (pgtap)

| Fichier | Couverture |
| --- | --- |
| `supabase/tests/permissions.sql` | RLS de toutes les tables, surface publique figée (liste exacte des fonctions accessibles à `anon`), fonctions internes inaccessibles, `search_path` des `SECURITY DEFINER`, absence de fuite de secrets / d'e-mails non masqués |
| `supabase/tests/reviews.sql` | Cycle de vie complet des avis : notification « mission terminée », 11 garde-fous (SQLSTATE `TLNAU`/`TLFOR`/`TLTMP`/`TLBAD`), publication, déduction du développeur, upsert, notes et réputation, lecture client/développeur/public, réponse publique, signalement, modération admin sans altération de la note |

Exécution :

```bash
# base locale (Supabase CLI)
supabase start && supabase test db

# projet lié (aucune installation requise)
export SUPABASE_ACCESS_TOKEN=sbp_…      # https://supabase.com/dashboard/account/tokens
export SUPABASE_PROJECT_REF=xxxxxxxxxxxx
npm run test:db
```

`scripts/db-test.mjs` fonctionne dans les deux cas (psql si `SUPABASE_DB_URL`
est défini, sinon API Management) et **vérifie après chaque fichier qu'aucune
fixture n'a subsigné** : les tests sont encadrés par `BEGIN` / `ROLLBACK`.

## Scripts

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
npm run test        # Vitest
npm run test:db     # pgtap (base locale ou projet lié)
npm run check       # typecheck + lint + test
npm run build       # build de production
```

## Roadmap (limites actuelles)

- Paiement réel Wave (actif) / Max It (hors service pour le moment) à brancher (webhook → `credit_tokens`).
- Pagination des briefs, rate limiting de `create_brief` (le plus court chemin
  vers le spam de notifications), modération auto.
- Suppression définitive de `token_refund_requests` (table vide, verrouillée
  par la migration 0031) si la fonctionnalité n'est pas reprise.