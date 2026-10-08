# Changelog

Toutes les modifications notables du projet TERANGA LABS sont documentées ici (§61 du cahier des charges). Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [P3-3] — 2026-10-08

Troisième vague du chapitre P3 : **verrouillage des RPC récentes + tests pgtap RLS** (audit C7/§32).

### Correctif de sécurité (migration `0047_revoke_privilege_public.sql`)
- PostgreSQL accorde EXECUTE à PUBLIC sur toute fonction créée : les RPC de `0044`→`0046` (agences, sponsoring, PRO) restaient donc invocables par n'importe quel visiteur malgré leurs `grant` ciblés.
- Le cas le plus critique : `debit_tokens` ne vérifie pas `auth.uid() = p_user` — un utilisateur connecté pouvait, via PUBLIC, **débiter le solde d'un autre développeur**. La migration révoque PUBLIC (et anon/authenticated pour `debit_tokens`) sur les 15 RPC sensibles ; les invocations internes des RPC sponsor/PRO (SECURITY DEFINER) restent fonctionnelles (rôle owner).
- Les fonctions réellement publiques (annuaire, prix) sont conservées : `list_agencies`, `get_agency`, `get_agency_by_developer`, `get_sponsoring_prices`, `get_pro_prices`, `get_pro_status`.

### Tests pgtap (nouveau)
- `supabase/tests/rls_critique.sql` (plan 7) : RLS activée sur les 10 entités critiques récentes, aucune écriture ouverte à un visiteur, 17 RPC sensibles jamais exécutables par anon, `debit_tokens` hors de portée des rôles navigateur, RPC de découverte toujours publiques, garde `has_role` non-PUBLIC, sponsor/PRO/agence exécutables par `authenticated`.
- `supabase/tests/permissions.sql` : surface anon figée mise à jour (+6 fonctions publiques) — le garde-fou reste valide.

### Vérifications
- typecheck ✔, lint 0/0 ✔, **174 tests** ; `rls_critique.sql` et `0047` s'exécuteront sur le job CI `db-tests` au prochain push.

## [P3-2] — 2026-10-08

Deuxième vague du chapitre P3 : **abstraction `PaymentProvider`** (§6 audit, PayDunya ⇄ Wave).

### `lib/payments/provider.ts`
- Contrat commun `PaymentProvider.nom/isConfigured/isApiError/createCheckout` avec deux implémentations (PayDunya PAR, Wave Checkout Session).
- `getPreferredProvider(requested)` : résolution serveur du prestataire (`auto`, `paydunya` + repli Wave, `wave`), retour `null` quand rien n'est opérationnel.
- `getProviderByName(name)` + types `CheckoutInput`/`ProviderCheckoutResult` partagés.

### Simplification des routes
- `payments/checkout` : suppression des deux branches parallèles PayDunya/Wave au profit d'un appel unique ; même ordre de préférence, mêmes messages 503/502, mêmes écritures `payment_intents` (comportement préservé ; l'intention n'est créée qu'après la vérification qu'un prestataire existe).
- `verification/checkout` : passage sur le provider Wave via le contrat (l'option historique `max_it` n'existe pas côté PayDunya, comportement inchangé).

### Tests
- `tests/payments-provider.test.ts` : résolution du prestataire (priorité, repli, null), contrat commun (Wave : session+client_reference ; PayDunya : facture + `custom_data`), via mocks fetch.

### Vérifications
- typecheck ✔, lint 0/0 ✔, **174 tests** (dont 7 nouveaux).

## [P3-1] — 2026-10-08

Première vague du chapitre P3 (qualité de production) : **centralisation des gardes de route** (audit C7/§33).

### Gardes
- `lib/auth/guards.ts` : ajout de `apiRequireUser()` (session uniquement, réponse JSON 401) et de `CONNECTED_ROLES` (les 6 rôles reconnus).
- **8 pages** migrées vers `requireUser()` / `requireRole()` : `/client`, `/dashboard`, `/conversations`, `/conversations/[id]`, `/missions`, `/notifications`, `/parametres`, `/review/[id]` — plus aucune page n'écrit `redirect("/login")` en dur.
- **6 routes API** migrées vers `apiRequireUser()` : `briefs/publish`, `otp/request`, `otp/verify`, `payments/checkout`, `payments/status`, `verification/checkout` ; `favorites/toggle` réutilise `CONNECTED_ROLES`.
- `payments/ipn` et `payments/webhook` restent volontairement publiques (callbacks signés) ; `ai/brief-assist` reste public (limité par IP).

### Régression (nouveau)
- `tests/route-guards.test.ts` : aucun `redirect("/login")` en dur dans `app/`, aucun `getCurrentUser()` direct dans les routes API, listes des routes protégées sous contrôle.

Comportement conservé : les branchements de rôle existants (`get_my_role` → `/dashboard` ou `/client`) sont inchangés pour ne pas pénaliser les anciens comptes sans entrée `user_roles`.

### Vérifications
- typecheck ✔, lint 0/0 ✔, **167 tests** (dont 3 nouveaux).

## [P2] — 2026-10-08 : chapitre terminé

Six vagues livrées. Bilan final du chapitre P2.

| Vague | Contenu |
| --- | --- |
| P2-1 | TERANGA SCORE à 7 composantes + TERANGA MATCH brief ↔ développeur |
| P2-2 | Agences (création, invitations, membres, annuaire, badges) |
| P2-3 | Sponsoring (profils & briefs mis en avant, paiement en Tokens) |
| P2-4 | Abonnement PRO (achat en Tokens, badge PRO, annuaire) |
| P2-5 | IA brief assistant (fallback règles + LLM optionnel) |
| P2-6 | Qualité : build complet, lint, typecheck, tests |

**Migrations livrées : `0043_score_match` → `0046_pro_subscription`.** À appliquer dans l'ordre dans le SQL Editor Supabase.

État final vérifié :
- typecheck ✔, **lint 0 warning**, **164 tests verts**, **build Next complet** (compilé en 3,4 min, 22 pages statiques générées, aucune erreur).

Rappel des règles d'exploitation :
- Le sponsoring et le PRO se paient **en Tokens** (pas d'auto-récurrence) → aucun blocage extérieur.
- L'assistant IA fonctionne **sans clé LLM** ; si `AI_API_KEY` est posée (endpoint OpenAI-compatible), il bascule automatiquement en mode LLM avec repli sûr.

## [P2-5] — 2026-10-07

Cinquième vague du chapitre P2 : l'**assistant IA de rédaction des briefs**, sans blocage externe.

### « IA brief assistant » (`lib/ai/brief-assistant.ts`)
- **Mode règles (toujours actif)** : nettoyage de la description, complétion d'une phrase trop courte, détection du type de projet (vitrine, e-commerce, landing, application, refonte) et suggestions d'enrichissement calibrées secteur.
- **Mode LLM optionnel** : si `AI_API_KEY` (+ `AI_BASE_URL`, `AI_MODEL`) sont définis, l'endpoint compatible OpenAI reformule la description et produit des suggestions (timeout 7 s, retour automatique sur le mode règles en cas d'échec — aucune dépendance bloquante).

### Interface + sécurité
- Route `POST /api/ai/brief-assist` (limite 10/min par IP, validation stricte).
- Formulaire « Publier un brief » : bouton **« Améliorer avec l’IA »** au-dessus de la description + affichage des suggestions sous le champ, avec protection contre la double soumission.

### Vérifications
- typecheck ✔, lint 0/0 ✔, **164 tests** (dont 5 nouveaux pour le mode règles).

## [P2-4] — 2026-10-07

Quatrième vague du chapitre P2 : l'**abonnement PRO** (payé en Tokens, sans carte récurrente).

### Migration `0046_pro_subscription.sql`
- Table `subscriptions` (période active `ends_at`, plan `pro`, RLS lecture seule) + réécriture v3 de `list_approved_developers` avec `is_pro` / `pro_until`.
- `subscribe_pro()` : achète une période de `pro_duration_days` jours (défaut 30) au prix de `app_settings.pro_price_tokens` (défaut 15 Tokens), prolonge l'abonnement existant.
- `get_pro_status(p_developer_id)` : statut public du badge (actif → `ends_at`);
- `get_pro_prices()` + `admin_set_pro_prices(...)` pour l'équipe.

### Interface
- **Dashboard développeur → onglet « Abonnement PRO »** : état actuel + activation / prolongation en 1 clic.
- **Annuaire et fiche `/dev/[username]`** : badge PRO (couronne) quand la période est active.

### Vérifications
- typecheck ✔, lint 0/0 ✔, 159 tests ✔.

## [P2-3] — 2026-10-07

Troisième vague du chapitre P2 : le **sponsoring** (mise en avant payante en Tokens).

### Migration `0045_sponsoring.sql`
- Tables `sponsored_profiles` et `sponsored_briefs` (période cumulable, durée 1-30 jours, RLS lecture seule) + `debit_tokens` (verrou anti-course, transaction négative).
- `sponsor_dev_profile(p_days)` : débit Tokens au prix journalier de `app_settings.sponsoring_profile_price_tokens` (défaut 2), le profil remonte en tête de l'annuaire.
- `sponsor_brief(p_request_id, p_management_key, p_days)` : idem pour un brief ouvert (le client détenteur de la clé), prix `sponsoring_brief_price_tokens`.
- `get_sponsoring_prices()` (lecture publique des tarifs) et `admin_set_sponsoring_prices(...)` (admin).
- `list_approved_developers` réécrite (mêmes paramètres) : ajout de `is_sponsored`/`featured_until` et tri « sponsorisés d'abord ».

### Interface
- **Annuaire** : les profils sponsorisés sont affichés en tête, quel que soit le tri.
- **Marketplace des briefs** : badge « Mis en avant » + sponsorisés triés en premier (`isBriefSponsored` + relation `sponsored_briefs`).
- **Dashboard développeur → Réputation & commandes** : panneau « Promouvoir mon profil » (7/14/30 jours, prix dynamique).
- **Brief ouvert (page de gestion du client)** : panneau « Mettre ce brief en avant » avec choix de durée.

### Vérifications
- typecheck ✔, lint 0/0 ✔, 159 tests ✔.

## [P2-2] — 2026-10-07

Deuxième vague du chapitre P2 : les **agences** rejoignent la plateforme.

### Migration `0044_agencies.sql`
- Tables `agencies` (nom, slug unique, bio, logo, ville, pays, site, `verified`, `status` pending/active/suspended, code d'invitation secret, owner) et `agency_members` (un développeur = une agence au maximum).
- RLS : lecture publique des agences actives uniquement ; toute écriture via RPC SECURITY DEFINER.
- RPC : création, rejoint par code (`get_agency_by_invite` + `join_agency`), régénération du code, retrait de membre, départ, passage de statut (admin), `list_agencies`, `get_agency` (avec membres), `get_agency_by_developer`, `my_agency`.

### Interface
- **Page `/agences`** : annuaire public des agences actives.
- **Page `/agences/[slug]`** : fiche de l'agence + membres (liens vers les fiches développeurs) + metadata SEO.
- **Fiche `/dev/[username]`** : badge « {Nom de l'agence} » cliquable quand le développeur appartient à une agence.
- **Dashboard développeur → onglet « Mon agence »** : créer son agence, gérer invitations (code + régénération), retirer des membres, quitter.

### Vérifications
- typecheck ✔, lint 0/0 ✔, 159 tests ✔.

## [P2-1] — 2026-10-07

Première vague du chapitre P2 : le TERANGA SCORE passe au niveau supérieur et TERANGA MATCH entre en scène.

### Migration `0043_score_match.sql`
- **SCORE composé** : `refresh_developer_reputation` recalcule désormais le score 0-100 en 7 composantes, stockées dans `developers.score_components` (colonne managée) : note moyenne des clients (35), projets terminés (20, missions `completed` sans jamais descendre sous l'héritage `unlocks gagne`), volume d'avis (15), complétude du profil (15, 9 indicateurs), réactivité (10), bonus vérifié (+5) et pénalités.
- **Recalcul automatique** étendu aux missions (`status`), `developer_services`, `developer_profiles` et aux champs de profil (`bio`, `avatar_url`, `city`, `whatsapp`, `experience_years`, `skills`).
- **TERANGA MATCH** : `teranga_match(p_project_type, p_city, p_budget, p_services, p_limit)` — top N développeurs compatibles, score 0-100 décomposé (type 45 / ville 20 / budget 15 / réputation 15 / disponibilité 5).
- **`get_developer_score(p_identifier)`** : expose score + niveau + composantes pour la fiche publique.

### Interface
- **Fiche `/dev/[username]`** : section « Score Teranga » avec le détail des 7 composantes en barres.
- **Fiche `/briefs/[id]`** : panneau « Développeurs recommandés » (Teranga Match) pour chaque brief ouvert.

### Vérifications
- typecheck ✔, lint 0/0 ✔, 159 tests ✔.

## [P1] — 2026-10-07 : chapitre terminé

Le chapitre P1 est bouclé en 6 vagues (`4024c80`, `e88792c`, `3c08cc5`, `493321f`, `5538e2b`, `b954408`), toutes poussées sur `main`. Bilan des vagues :

- **P1-1** — Annuaire et fiches développeurs publics (`/dev`, `/dev/[username]`), briefs publics (`/briefs`, `/briefs/[id]`).
- **P1-2** — La marketplace devient payante au Token : publication de brief et déblocage à 1 Token ; CGU, mentions légales et pages légales mises à jour.
- **P1-3** — Classement réel : `leaderboard_monthly` + règlement périodique (`settle_leaderboard`), page `/classement` (live/clos, palmarès, pays), route admin.
- **P1-4** — Workspace de mission (§22) : page `/missions`, création depuis une offre acceptée dans la conversation, statuts/historique pour les deux parties (`0042_missions_ui.sql`).
- **P1-5** — Sitemap : indexation des fiches `/dev/[username]` (ISR 1 h).
- **P1-6** — Qualité : 10 `<img>` → `next/image` (remotePatterns flagcdn + stockage Supabase), `console.error` → logs structurés `lib/log`, lint 0 warning.

### États finaux
- **0 erreur / 0 warning ESLint**, **159 tests verts**, `tsc --noEmit` sans erreur, build Next complet (compilation turbopack ~4,4 min ; pages statiques + dynamiques ; `sitemap.xml` généré).
- Blocage connu non bloquant : le build a pu être tué au timeout sur « Collecting build traces » selon les conditions machine — les vérifs fiables sont typecheck/lint/tests.

### Reste à faire (hors ch. P1)
- Suites produit à cadrer (chapitres suivants) — voir plan de déploiement.

## [P1-6] — 2026-10-07

Sixième vague du chapitre P1 : la propre qualité du code.

### Corrigé
- **`img` → `next/image`** sur les 10 occurrences de `<img>` brut (drapeaux, avatars, captures de missions) : les anciennes `<img>` généraient 4 warnings lint et des requêtes non optimisées. Les URL libres des utilisateurs (avatars, screenshots, portfolio) passent en `unoptimized` pour préserver les hôtes arbitraires ; correction au passage de `images.remotePatterns` (flagcdn + stockage Supabase) qui faisait défaut alors que le footer utilisait déjà `next/image` distant.
- **`console.error` → `log` structuré** (`lib/log`) dans les routes `payments/ipn`, `payments/webhook` et `otp/verify` : chaque erreur est maintenant une ligne JSON portant action/providers, exploitable par les collecteurs. Restent `console.error` dans `error.tsx`/`global-error.tsx` (pattern du framework) et dans `log.ts` lui-même.
- **Dépendance superflue `budget`** dans le `useMemo` de `brief-filters` (avertissement `exhaustive-deps` supprimé).

### Vérifié (aucune action requise)
- La révocation d'un brief publié existe déjà : `update_brief_status(management_key, 'fermé')` depuis `brief-manager` retire le brief de l'annuaire public (RLS `status='ouvert'`).

## [P1-5] — 2026-10-07

Cinquième vague du chapitre P1 : référencement des fiches développeurs.

### Ajouté
- **Sitemap** : une URL par fiche `/dev/{username}` — seuls les profils approuvés sont indexés (source : `list_approved_developers`), priorité 0.6, fréquence hebdo. Le sitemap passe en régénération ISR (revalidation 1 h) au lieu d'un build statique figé.

## [P1-4] — 2026-10-07

Quatrième vague du chapitre P1 : le workspace de mission (§22) passe enfin à l'écran — création depuis une offre acceptée, suivi de statut et historique, pour les deux parties.

### Ajouté
- **Migration `0042_missions_ui.sql`** : RPC `list_my_missions()` (security definer, `authenticated`) — retourne les missions du développeur OU du client avec partie adverse (développeur : nom/pseudo/ville/avatar ; client : société/contact/ville), infos du brief (hors WhatsApp), et le journal `mission_events`. Contourne la RLS `requests` (seuls les briefs « ouverts » sont lisibles en direct).
- **Page `/missions`** : sécurisée (connexion requise, `noindex`), liste réelle des missions pour les deux rôles — montant, délai, début, partie adverse, description.
- **Composant `MissionsDashboard`** : filtres (Toutes / En cours / Terminées / Litiges / Annulées), transitions de statut conformes à la machine à états 0038 (`new→in_progress→completed` par le développeur ; `*→disputed`, `→cancelled` par le client) avec dialogue de confirmation et commentaire, historique d'événements dépliable, focus `?focus=<id>`.
- **Création depuis une offre acceptée** : dans le fil de discussion, le client voit « Démarrer la mission » (RPC `create_mission_from_offer`) dès l'attribution ; une fois créée, « Suivre la mission » pointe vers `/missions?focus=<id>`.
- **Lib `lib/mission-labels.ts`** : statuts §22 (libellé + badge), transitions par rôle, mapping des codes d'erreur RPC (`TLNAU/TLNFO/TLNOC/TLPEN/TLDUP/TLNMI/TLTRN`).
- **Types** : `MissionStatus`, tables `missions` et `mission_events` ajoutées à `types/database.ts`.
- **Navigation** : lien « Missions » pour les comptes connectés (menu principal).

### Modifié
- `/conversations/[id]` charge désormais l'identifiant de mission lié à une conversation attribuée.

## [P1-3] — 2026-10-07

Troisième vague du chapitre P1 : le classement mensuel devient réel (§22/§35), calculé sur les missions terminées — plus aucun placeholder.

### Ajouté
- **Migration `0041_leaderboard_real.sql`** :
  - `get_leaderboard(year, month)` (lecture `anon/authenticated`) : mois en cours → classement **live** recalculé à chaque lecture (missions `status='completed'` avec `completed_at` dans le mois, seuil `>= 2` missions) ; mois clos → **settlement idempotent** automatique puis relecture en base.
  - `_leaderboard_standings` (créneau régional + rang par pays, pays issus de `developers.country`), `_leaderboard_settle` (upsert `leaderboard_monthly`, **crédit Tokens unique** `type='reward'` 5/2, badges `top1_/top2_regional|_country`, archive `leaderboard_monthly_history`), `settle_leaderboard` (déclenchement manuel, garde service_role/admin via `has_role`).
  - Type `'reward'` ajouté au CHECK de `token_transactions` (conserve `purchase/unlock/bonus/publish/contact/adjust/gift`).
- **Page `/classement` réelle** : serveur, charge `get_leaderboard`, tableaux rang réel (régional + 9 pays), badges Top 1/Top 2, état live vs mois clos, seuil et récompenses affichées depuis la config, palmarès des 6 mois précédents.
- **Route admin** `POST /api/admin/leaderboard/settle` : déclenchement manuel du settlement (gardes `apiRequireRole(["admin"])` + rate limit, service_role pour la RPC).
- **Types** : `get_leaderboard` / `settle_leaderboard` ajoutés à `types/database.ts`.

### Modifié
- `/classement` : le placeholder « bientôt disponible » est remplacé par le classement calculé en base (aucun chiffre inventé).

## [P1-2] — 2026-10-06

Deuxième vague du chapitre P1 : le maillage géographique réel de la marketplace (C2/C14/§37).

### Ajouté
- **Helpers géographiques** (`lib/geography.ts`) : `countryCodeForPlace`, `findRegionByPlace`, `countryForPlace` — résolution d'une localité libre (nom de pays, région ou code ISO) vers le pays / la région du référentiel (§2, 9 pays). Couverts par 12 tests (`tests/geography.test.ts`).
- **Deep-links géographiques** : `/dev?city=<pays|ville>` pré-remplit l'annuaire (`list_approved_developers p_city` côté serveur + état initial du filtre). Les pages `/pays/{slug}` proposent désormais « Développeurs en {pays} » vers l'annuaire ; leurs liens régions (`/briefs?country=&region=`) sont maintenant réellement consommés.
- **Filtre pays/région fonctionnel sur `/briefs`** : le sélecteur pays (9 pays) filtre via le mapping géo (et non plus sur des colonnes inexistantes), la sélection d'une région résout nom→code (`?country=SN&region=Dakar`), et le champ « ville » liste les villes réellement présentes dans les briefs chargés.

### Corrigé
- **Bug C14 latent** : choisir un pays dans `/briefs` effaçait tous les briefs — le filtre comparait à des champs `country`/`region` jamais sélectionnés en base (`BRIEFS_COLUMNS`). Désormais fondé sur `client_city` + référentiel.
- **Libellés « au Sénégal » résiduels (C1)** : métadonnées `/briefs`, vitrine développeur (`/dev/{username}`, métadonnées + pied de page) → « Afrique de l'Ouest francophone ».
- **Mojibake dans `brief-filters.tsx`** (placeholders/labels écrits en double-encodage) recodés en UTF-8 correct.

## [P1-1] — 2026-10-06

Première vague du chapitre P1 : géographie multi-pays (C1), interface et contenu marketing, favoris, puis le socle d'audience.

### Ajouté
- **Migration `0039_analytics_events.sql`** : table `analytic_events` + RPC `track_event` (écriture `service_role` uniquement, pas de lecture publique) — chaque ligne correspond à une action réelle constatée en base (§36).
- **Migration `0040_favorites.sql`** : table `favorites` (UNIQUE user+request, RLS lecture/suppression personnelle) + RPC `toggle_favorite` (bascule atomique) et `is_favorited` (§25).
- **Pages pays (`C13`)** : `app/pays/page.tsx` (répertoire des 9 pays de la zone) et `app/pays/[slug]/page.tsx` (vue pays : projets web « à partir de X F », langues parlées, villes couvertes, état du marketplace). Modèle `lib/geography.ts` avec 9 pays, 31 villes — la Guinée-Bissau des précédentes vagues est déjà incluse.
- **Sitemap** : `/classement`, `/dev`, `/pays` + une URL par pays pays (priorité 0.6, fréquence hebdo).
- **API favoris** : `POST /api/favorites/toggle` (authentifiée, zod `favoriteToggleSchema`, rate limit 30/min).
- **Composant `FavoriteButton`** (cœur optimiste, retour arrière sur erreur, redirection `/login` si déconnecté) branché sur les cartes de `/briefs`.
- **Tracking d'usage réel** : `brief_published` (publish), `otp.requested` / `otp.verified` (request/verify OTP), `payment.credited` (webhook PayTech + IPN PayDunya).

### Modifié
- **Titres obsolètes** : `/briefs` (« au Sénégal » → « sur le marketplace ») — le périmètre est multi-pays depuis C1.
- **Types Supabase** : `track_event`, `toggle_favorite`, `is_favorited` ajoutés à `types/database.ts`.

## [P0-1] — 2026-10-06

Première vague du chapitre P0 (audit → corrections conformité → sécurité).

### Ajouté
- **Migration `0036_rbac_roles.sql`** : rôles `agency` et `support` ajoutés au CHECK de `user_roles` (§33) ; RPC `has_role(text[])` (security definer) pour les gardes serveur.
- **Migration `0037_otp_verifications.sql`** : vérification téléphone/email par OTP (§9) — code haché (`sha256`), expiration 10 min, tentatives bornées (5), anti-abus (5 demandes / 15 min par cible), colonnes `phone_verified` sur `developers` et `client_profiles`. Le code n'est retourné qu'au `service_role` (jamais au navigateur).
- **Migration `0038_missions.sql`** : table `missions` (+ `mission_events`), machine à états `new → in_progress → completed / disputed / cancelled`, RPC transactionnelles `create_mission_from_offer` et `mission_update_status`, RLS participants (§22). Créé aussi `update_updated_at_column()` (référencé mais absent depuis 0035).
- **API OTP** : `POST /api/otp/request` (émet + ENVOIE réellement via le provider configuré) et `POST /api/otp/verify` (vérifie par RPC, jamais côté client).
- **Validation `zod` systématique** : schémas `paymentCheckoutSchema`, `paymentStatusSchema`, `verificationCheckoutSchema`, `otpRequestSchema`, `otpVerifySchema` appliqués aux routes API (audit C5).
- **Rate limiting** : `lib/rate-limit.ts` (fenêtre glissante, IP + route) appliqué à `/api/payments/checkout`, `/api/payments/status`, `/api/verification/checkout`, `/api/briefs/publish`, `/api/otp/*` (audit C6).
- **Garde de route centralisée** : `lib/auth/guards.ts` (`requireUser`, `requireRole`, `apiRequireRole`) (audit C3/C7).
- **Logs structurés** : `lib/log.ts` (JSON, niveau, action, user, request_id, provider) branché sur les routes paiement et OTP (audit C8).
- **Tests** : `tests/rate-limit.test.ts` et `tests/security-validations.test.ts` (+21 tests, total 147).

### Modifié
- **Conformité géographique (§2, audit C1)** : le périmètre passe officiellement à **9 pays** d'Afrique de l'Ouest francophone — **Guinée-Bissau ajoutée** (`lib/countries.ts`, drapeau du footer) ; toute référence à « UEMOA » retirée des libellés publics (la Guinée n'en est pas membre) — `components/footer.tsx`, `app/classement/page.tsx` (metadata, en-tête, légendes), `components/landing/content.ts` (hero « 9 pays », FAQ pays incluant la Guinée-Bissau) ; `UEMOA_COUNTRY_CODES` renommée `SCOPE_COUNTRY_CODES`.
- **Types Supabase** : `has_role`, `request_otp`, `verify_otp`, `create_mission_from_offer`, `mission_update_status` ajoutés à `types/database.ts`.

### Sécurité
- Le code OTP n'est jamais stocké en clair (hash SHA-256) et ne transite jamais vers le navigateur.
- Les transitions de mission sont bornées par rôle et journalisées (intégrité de la donnée), montants gelés côté serveur.