# Changelog

Toutes les modifications notables du projet TERANGA LABS sont documentées ici (§61 du cahier des charges). Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

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