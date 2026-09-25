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
supabase/           Migrations SQL, seed, RPC
```

## Configuration locale

```bash
npm install
cp .env.example .env.local   # renseigner NEXT_PUBLIC_SUPABASE_URL / SERVICE KEY
npm run dev                  # http://localhost:3000
```

### Supabase (production)

1. Créer un projet Supabase.
2. Exécuter les migrations dans l'ordre : `supabase/migrations/0001_initial_schema.sql`,
   `0002_rls.sql`, `0003_rpc.sql` (SQL Editor).
3. Insérer les données de démo : `supabase/seed.sql` (6 briefs).
4. Configurer **Auth → URL : http://localhost:3000** et le redirect à `/auth/confirm`.

> Sans `.env.local` renseigné, l'app tourne en « mode démo » (aucun appel Supabase).

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
- Création automatique du profil développeur via le trigger `handle_new_user`.

## Économie des Tokens

- `token_transactions` : `amount` (positif = crédit, négatif = débit),
  `amount_fcfa` (paiement réel éventuel), `type` ∈ `purchase` / `bonus` /
  `unlock`, `request_id` pour tracer le déblocage.
- **Aucun paiement simulé** : le bouton d'achat affiche « Paiement bientôt
  disponible ». Le crédit est administrable via `/admin` (`credit_tokens`).

## Scripts

```bash
npm run lint   # ESLint
npm run build  # build de production + vérification des types
```

## Roadmap (limites actuelles)

- Paiement réel Wave (actif) / Max It (hors service pour le moment) à brancher (webhook → `credit_tokens`).
- Pagination des briefs, notifications, modération auto.