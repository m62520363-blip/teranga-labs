# Déploiement — TERANGA LABS

> Guide opérationnel (§66 du cahier des charges). Site : `teranga-labs` (Vercel).
> Console admin : `teranga-labs-admin` (Vercel, dépôt séparé).

## 1. Prérequis

- **Node.js 22** et npm (CI et local).
- Un projet **Supabase** (Postgres + Auth) avec les rôles `anon`, `authenticated`, `service_role` (créés par défaut).
- Une boutique **Chariow** avec une clé API (`sk_…`) et un Pulse configuré (voir `.env.example`).
- Un dépôt **GitHub** avec CI active (`.github/workflows/ci.yml`).

## 2. Variables d'environnement

Le gabarit complet et commenté est dans **`.env.example`** — ne jamais coller de clé
dans un commit, une issue ou une conversation.

| Variable | Où | Rôle |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + CI (repo vars `SUPABASE_URL`, `SUPABASE_ANON_KEY`) | Connexion publique (build + navigateur) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Vercel uniquement** (serveur) | Crédits post-paiement, webhooks. Jamais côté client. |
| `CHARIOW_API_KEY` / `CHARIOW_PULSE_SECRET` / `CHARIOW_BASE_URL` | Vercel | Prestataire de paiement unique Chariow (checkout + Pulse webhook) |
| `NEXT_PUBLIC_APP_URL` | Vercel | URL publique (retours de paiement) |
| `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` | Local (optionnel) | `npm run test:db` via l'API Management |

## 3. Migrations

1. Ordre strict : `supabase/migrations/0001_…` → `0055_…` (dernières : méthode
   de vérification Chariow, correctif des types de transactions Tokens).
2. Application via le **SQL Editor Supabase** (un fichier à la fois, dans l'ordre), ou
   `supabase db push` pour les équipes outillées CLI.
3. Règles **non destructives** : `CREATE … IF NOT EXISTS`, `ALTER`, jamais `DROP` sur
   une table existante (§57, risque R2) — les données de production sont précieuses.
4. Vérification locale avant production : `supabase start` (base éphémère) puis
   `npm run test:db` (pgtap : RLS, surface anon figée, garde des RPC sensibles).

## 4. Déploiement Vercel (site)

1. Connecter le dépôt `teranga-labs` à Vercel ; framework auto-détecté (Next.js).
2. Renseigner les variables de l'article 2 (Production et Preview).
3. Build : `npm run build` (Turbopack, pas de commande custom requise).
4. Après déploiement : vérifier `/`, `/login`, une page publique (`/faq`) et le
   webhook : l'URL du Pulse déclarée chez Chariow (`/api/payments/webhook`)
   doit répondre (GET → `{"ok":true,"service":"chariow-pulse"}`).

Console admin : même principe sur `teranga-labs-admin`, avec `NEXT_PUBLIC_ADMIN_URL`
cohérent côté site.

## 5. CI (`.github/workflows/ci.yml`)

| Job | Contenu |
| --- | --- |
| `quality` | typecheck, lint, tests unitaires (vitest) |
| `build` | build de production (vars Supabase via repo vars) |
| `db-tests` | `supabase start` (applique les migrations) + `npm run test:db` (pgtap) |
| `e2e` | `playwright install chromium` + `npm run test:e2e` (build + `next start` sur port 3100) |
| `secrets` | gitleaks (détection de secrets) |

Le job `e2e` nécessite les **repo variables** `SUPABASE_URL` et `SUPABASE_ANON_KEY`
(Settings → Secrets and variables → Actions).

## 6. Après chaque déploiement

- Pages publiques : accueil, `/faq`, `/plan-du-site` (200), route inconnue (404).
- `/dashboard` sans session → redirection `/login`.
- Un paiement de test : intention créée, Pulse Chariow reçu, re-vérification
  `GET /v1/sales/{id}` concluante, crédit posé une seule fois (idempotence
  `credit_from_payment`), rejeu du Pulse sans double crédit.
- `npm run check` vert avant chaque push ; CI verte après.

## 7. Rappels sécurité

- `service_role` : **serveur uniquement** (jamais dans le code client, ni `NEXT_PUBLIC_*`).
- Les RPC sensibles sont révoquées de `PUBLIC` (migration `0047`) : toute nouvelle
  fonction privée doit être `REVOKE … FROM PUBLIC` + `GRANT` ciblé, sous peine
  d'être exécutable par tous (voir `supabase/tests/permissions.sql`, surface figée).
- La signature du Pulse Chariow (HMAC-SHA256 du corps brut) et la
  re-vérification montant côté serveur (`GET /v1/sales/{id}`) sont
  **indispensables**, ne jamais les retirer : les Tokens ne sont crédités
  qu'après confirmation.
- Rotation des clés Chariow (API + secret Pulse) en cas de doute ;
  `.env` Vercel jamais committé.