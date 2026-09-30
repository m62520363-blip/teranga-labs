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
  migrations/       32 migrations SQL (0001 → 0032)
  tests/            tests pgtap (permissions.sql, reviews.sql, contact_spam.sql)
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
- **Écriture : RPC uniquement** — un visiteur n'a plus *aucun* privilège
  `INSERT` direct sur `requests` ni `contact_messages` : publier passe par
  `publish_brief` (session + 1 Token), écrire au support par
  `submit_contact_message` (validation + limite). Deux politiques RLS
  `with check (true)` ouvertes à `anon` subsistaient depuis 0002/0023 et
  permettaient de court-circuiter ces deux chemins (migration 0032).
- **Anti-spam formulaire de contact** : 3 messages maximum par adresse email sur
  fenêtre glissante de 24 h (`SQLSTATE TLLIM`), indexé sur `(email, created_at)`.
  Sans ce verrou, chaque envoi notifiait tous les administrateurs.
- ⚠️ **PostgreSQL** : une fonction hérite d'EXECUTE via `PUBLIC`. `revoke …
  from anon` seul ne protège donc rien — chaque révocation porte aussi sur
  `PUBLIC` (cf. migration 0031). Ce piège avait laissé 88 fonctions
  (dont `notify_user` et toutes les `admin_*`) exécutables par un visiteur.
- Création automatique du profil développeur via le trigger `handle_new_user`.

Ces règles sont **testées**, pas seulement documentées : voir
`supabase/tests/permissions.sql`.

## En-têtes de sécurité

`middleware.ts` pose sur chaque réponse HTML (vérifié en HTTP réel) :

| En-tête | Valeur |
| --- | --- |
| `X-Frame-Options` | `DENY` |
| `Content-Security-Policy` | `frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

Une CSP complète n'est **pas** posée volontairement : Next.js injecte des
scripts en ligne, une CSP statique casserait l'application, et elle réclame
des nonces par requête (à faire si le point devient critique).

## Performance

- Les appels d'authentification serveur (`createClient`, `getCurrentUser`,
  `getCurrentDeveloper`, `getCurrentRole`) sont enrobés dans `cache()` React :
  **un seul** aller-retour Supabase Auth par requête au lieu de 3-4. Sans
  `cache()`, le layout racine faisait déjà 2 appels, puis chaque page répétait
  `getCurrentUser()`.
- `getCurrentRole()` court-circuite pour les visiteurs anonymes : le RPC
  `get_my_role` exige une session, appeler le réseau pour rien était perdu
  (le visiteur anonyme est le cas majoritaire en lecture).
- **Principe** : ces pages sont dynamiques volontairement — les données
  dépendent de l'utilisateur et la RLS se résout avec ses cookies. Toute
  tentative de cache ISR/statique sur `app/briefs/*`, `/client`, `/dashboard`
  est une **fuite de données** latente. Les pages publiques le sont aussi via
  `createClient()` (qui lit les cookies) — c'est le coût d'un SSR correct.
- ⚠️ **`loading.tsx` et les gardes serveur** : un `loading.tsx` crée une
  boundary Suspense qui se résout *avant* que le page ne termine de streamer.
  Si la page appelle `redirect()` ou `notFound()` (brief inexistant, profil
  inconnu, accès non autorisé), le statut/code n'est plus transmissible et le
  squelette reste affiché à vie. C'est ce piège qui avait d'abord cassé les
  404 de `/briefs/[id]`, `/dev/[username]` et les redirections `/dashboard` et
  `/client`. Le projet n'utilise donc **aucun** `loading.tsx` de route. Si un
  squelette est nécessaire plus tard, le faire dans un composant client avec
  un état `loading` explicite, jamais via un `loading.tsx` au-dessus d'une
  page avec `redirect()`/`notFound()`.

## SEO

- `metadata` complet dans `app/layout.tsx` : OpenGraph, Twitter Card
  (`summary_large_image`), `robots`, icônes, `manifest.json` (PWA avec
  icônes 192/512 maskable).
- `/sitemap.xml`, `/robots.txt`, JSON-LD (Organization) sur la page d'accueil.
- **13 pages privées** (dashboard, client, tokens, notifications,
  conversations, paramètres, login/signup, vérification, inscription,
  poster, avis) sont en `robots: noindex` : sans cela Google indexait des
  rendus vides de `/dashboard` anonyme.
- La 404 définit son propre titre et `noindex`.

## Stabilité & gestion d'erreur

- `app/error.tsx` : boundary d'erreur racine avec bouton **Réessayer**
  (`reset`), message rassurant et affichage du `digest` Next.js pour les
  signalements.
- `app/global-error.tsx` : prend le relais si le layout racine lui-même a
  échoué (styles inline obligatoires), retry via `reset` et retour à l'accueil
  par navigation complète.

## Design system

Toutes les couleurs passent par les tokens de `app/globals.css` — plus aucune
valeur hexadécimale en dur dans les composants.

| Token | Valeur | Rôle |
| --- | --- | --- |
| `--primary` | `#e86a2c` | orange TERANGA (boutons, liens, accents) |
| `--primary-foreground` | `--ink` `#0d0d0d` | texte **sur** un aplat orange |
| `--ink` | `#0d0d0d` | texte sur fond clair (secondaires inversés) |
| `--hairline` | `#2a2a2a` | filet de séparation des cartes |
| `--border-strong` | `#3a3a3a` | filet appuyé (traits de svg, barre de défilement) |
| `--border` | `#262626` | bordure de champ et de carte |
| `--surface` / `--surface-secondary` | `#0f0f0f` / `#141414` | fond de section et de carte |
| `--primary-soft` | `#2a1a10` | fond des encarts de marque (pastilles, bulles) |
| `--primary-light` | `#f2a378` | texte d'accent sur fond sombre (9:1) |
| `--primary-hover` | `#d95c1f` | survol des aplats orange |
| `--success` / `--warning` / `--error` | `#34d399` / `#fbbf24` / `#f87171` | statut : le trio est lisible en texte sur les surfaces sombres (≥ 9:1) |
| `--destructive` | `#b91c1c` | fond des boutons destructifs (libellé blanc 6.4:1) |

Les teintes translucides (`--accent-glow`, `--*-soft`) sont exprimées en
`color-mix()` sur ces tokens : plus de `rgba()` à dupliquer.

> **Contraste** : le texte posé sur un aplat de marque est le noir, pas le
> blanc. `#0d0d0d` sur `#e86a2c` = **6.04:1** (WCAG AA) alors que `#ffffff`
> sur la même couleur plafonne à **3.22:1** et échoue. Toute la surface —
> `.btn-primary`, `<Button>`, `<Badge>`, boutons de formulaire, badges —
> passe par `--primary-foreground`, donc le choix correct est appliqué une
> seule fois. Le reste de la palette est vérifié : texte principal 17.7:1,
> texte secondaire 7.9:1, succès 10.3:1, warning 11.9:1, erreur 6.3:1.

> Ajouter une couleur = ajouter un token dans `:root` **et** son alias
> `--color-*` dans `@theme inline`, puis n'utiliser que l'utilitaire
> (`bg-primary`, `text-ink`, `border-hairline`). Ne jamais réintroduire de
> hexadécimal dans un composant.

**Règle d'or vérifiable** : un utilitaire de couleur qui n'est pas exposé via
`@theme inline` n'est tout simplement pas généré par Tailwind — le fond
disparaît sans qu'aucun lint ne bronche (piège rencontré sur `*-soft`). Après
un build, les classes utilisées doivent exister dans `.next/static/chunks/*.css`.

**Exceptions assumées** (le CSS peut ne pas être chargé) :
`app/global-error.tsx` utilise des styles inline avec des littéraux hex, et
`viewport.themeColor` de `app/layout.tsx` reste un littéral — dans les deux cas
un `var(--token)` rendrait la page illisible. Ce sont les 10 seuls
hexadécimaux restants du code (hors adresse factice d'un témoignage).

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
npm run test:db   # tests pgtap sur la base (81 assertions)
npm run build     # build de production
```

### Tests SQL (pgtap)

| Fichier | Couverture |
| --- | --- |
| `supabase/tests/permissions.sql` | RLS de toutes les tables, surface publique figée (liste exacte des fonctions accessibles à `anon`), fonctions internes inaccessibles, `search_path` des `SECURITY DEFINER`, absence de fuite de secrets / d'e-mails non masqués, **aucune politique d'écriture atteignable par `anon`** (test durci : recherche par appartenance `roles && '{anon}'`, ce qui couvre aussi les politiques `{anon, authenticated}`) |
| `supabase/tests/reviews.sql` | Cycle de vie complet des avis : notification « mission terminée », 11 garde-fous (SQLSTATE `TLNAU`/`TLFOR`/`TLTMP`/`TLBAD`), publication, déduction du développeur, upsert, notes et réputation, lecture client/développeur/public, réponse publique, signalement, modération admin sans altération de la note |
| `supabase/tests/contact_spam.sql` | Fermeture de la surface d'écriture (zéro politique d'insertion visiteur, zéro privilège `INSERT` direct pour `anon`/`authenticated` sur `requests` et `contact_messages`) et fenêtre anti-spam du formulaire de contact (3 messages / email / 24 h, `SQLSTATE TLLIM`, sans effet de bord sur une autre adresse) |

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
- Modération auto des briefs.
- Suppression définitive de `token_refund_requests` (table vide, verrouillée
  par la migration 0031) si la fonctionnalité n'est pas reprise.

## Pagination des briefs

La liste charge 50 briefs par lot : les 50 plus récents sont rendus côté
serveur (`/briefs`), puis chaque clic sur « Afficher plus de briefs » ajoute le
lot suivant via la clé publique, les filtres recherche/région/type/budget
restant appliqués côté client sur l'ensemble chargé.

- Le titre et le compteur affichent le total exact renvoyé par PostgREST
  (`count: "exact"`), pas la taille de la fenêtre : le nombre ne peut plus
  mentir même au-delà de 50 briefs.
- Tri `created_at desc, id desc` : deux briefs créés dans la même seconde
  n'échangent pas de place entre deux lots, donc aucun brief n'est sauté ni
  affiché deux fois.
- Sélecteur de colonnes et taille de lot partagés entre serveur et client
  (`lib/briefs-pagination.ts`), pour que le lot ajouté soit identique au
  premier rendu.
- Le bouton disparaît une fois tout chargé ; un échec réseau affiche un message
  et laisse les briefs déjà affichés en place.
