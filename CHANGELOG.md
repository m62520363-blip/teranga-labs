# Changelog

Toutes les modifications notables du projet TERANGA LABS sont documentées ici (§61 du cahier des charges). Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

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