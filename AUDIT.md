# TERANGA LABS — Rapport d'audit

> Réalisé avant toute modification, conformément à la §3 et §60 du cahier des charges.
> Périmètre : `teranga-labs` (site) + `teranga-labs-admin` (console).
> Date : 2026-10-06 — Branche `main` @ `7d01760`.
> **Mise à jour : 2026-10-08 — les constats C1 → C14 sont tous traités
> (chapitres P0 → P4, voir §11). Les constats ci-dessous sont conservés
> pour l'historique.**

---

## 1. Ce qui existe

| Domaine | État | Détail |
|---|---|---|
| Framework | ✅ | Next.js 15.5.26 (App Router, Turbopack), React 19, TypeScript, Tailwind v4 |
| Base de données | ✅ | Supabase Postgres, **35 migrations** (`0001` → `0035`) |
| Tables | ✅ | 32 tables créées (voir §7) |
| Auth | ✅ | Supabase Auth (email/mot de passe), session refresh en middleware |
| RLS | ✅ | **32/32 tables** ont `enable row level security` |
| RPC | ✅ | **~120 fonctions** (dont 157 `security definer`) |
| Paiements | ✅ | PayDunya (PAR) + repli Wave, IPN + webhook |
| Notifications | ✅ | WhatsApp (GreenAPI/Twilio), email (Resend), webhook Make/n8n |
| Pages | ✅ | 31 routes `page.tsx` |
| Admin | ✅ | Console séparée `teranga-labs-admin` (login + `[module]`) |
| CI | ✅ | `.github/workflows/ci.yml` (typecheck, lint, build, détection de secrets) |
| Tests | ✅ | 126 tests Vitest (paiements 38, validations 35, tokens, régions…) |
| Scripts | ✅ | `npm run check` = typecheck + lint + test |

## 2. Ce qui fonctionne déjà (À NE PAS CASSER)

1. **Crédit de paiement idempotent** — `credit_from_payment` : refus hors `service_role`, verrou `status='pending' → 'paid'`, rejeu de webhook sans double crédit. (`0005_payments.sql`)
2. **Déblocage de contact transactionnel** — `unlock_and_start_chat` : contrôle auth, statut du compte (`active`), `SELECT … FOR UPDATE` sur le brief, anti-double-unlock, rollback si échec. (`0028_direct_contact.sql`)
3. **En-têtes de sécurité** — HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` à chaque réponse. (`middleware.ts:8-34`)
4. **En-têtes de sécurité** — Aucun secret en dur dans le code (vérifié : le seul `whsec_` est dans un commentaire de doc). `.env.example` complet et commenté.
5. **Statistiques réelles** — la landing lit `requests` en base (`app/page.tsx:85-133`), aucun chiffre inventé.
6. **Masquage des contacts** — `mask_phone` / `mask_email` en RPC.
7. **Validation serveur** sur la publication de brief (`zod`).

## 3. Ce qui est cassé / non conforme

| # | Constat | Réf. cahier | Gravité |
|---|---|---|---|
| C1 | **Libellé géographique faux** : le site affiche « 8 pays UEMOA » (footer, `/classement`, confiance) en incluant la **Guinée** (qui n'est pas membre UEMOA) et en omettant la **Guinée-Bissau**. Le cahier interdit explicitement de dire que tous ces pays appartiennent à l'UEMOA. | §2 | 🔴 Haute |
| C2 | **Pays/villes non couverts** : pages `/senegal`, `/abidjan`… **absentes** ; `/ville` et le sitemap ne gèrent que les régions du **Sénégal** (`lib/region-slugs.ts`). | §37 | 🟠 |
| C3 | **Rôles incomplets** : `user_roles` n'accepte que `developer, moderator, admin` — pas `client, agency, support, super_admin` (le client est deviné, pas déclaré). | §33 | 🔴 Haute |
| C4 | **Aucune vérification OTP/téléphone** : pas de table `otp_verifications`, pas d'envoi de code. `verification_requests` = vérification payante, pas un OTP. | §9 | 🔴 Haute |
| C5 | **Validation `zod` absente** sur `payments/checkout`, `payments/status`, `verification/checkout` (seul `briefs/publish` valide). | §35 | 🟠 |
| C6 | **Aucun rate-limiting** sur les routes API (anti-abus, brute force, spam). | §9/§32 | 🟠 |
| C7 | **Aucune garde de route centralisée** : la protection est recopiée page par page (`redirect("/login")`), le middleware ne fait que rafraîchir la session — un oubli = page exposée. | §33 | 🟠 |
| C8 | **Pas de logs structurés** (timestamp, user_id, action, request_id, provider, status). | §52 | 🟠 |
| C9 | **Workspace de mission absent** : `formal_offers` (offre) + `developer_projects` (portfolio) mais **pas de table `missions`** ni d'états NEW→IN_PROGRESS→COMPLETED→DISPUTED. | §22 | 🔴 Haute |
| C10 | **Analytics événementiel absent** (signup_completed, brief_published, contact_unlocked, payment_success…). | §36 | 🟡 |
| C11 | **Favoris absents**, **support/tickets absents**, **feature flags absents**, **disputes** et **risk_score** absents. | §25/§31/§32/§45/§48 | 🟡 |
| C12 | **TERANGA MATCH absent** (score de compatibilité calculé réellement). | §15 | 🟡 P1 |
| C13 | `/classement` **absent du sitemap**. | §37 | 🟡 |
| C14 | **Aucun test E2E, RLS, webhook, unlock, permissions** — les 126 tests couvrent la logique pure uniquement. | §50 | 🟠 |

## 4. Ce qui manque (tables exigées §34 vs existant)

**Existant (32)** : admin_actions, app_settings, client_profiles, contact_messages, conversations, developer_applications, developer_badges, developer_documents, developer_links, developer_profiles, developer_projects, developer_services, developers, formal_offers, leaderboard_monthly, leaderboard_monthly_history, messages, notification_jobs, notifications, payment_intents, payments, project_reviews, reports, requests, reviews, token_orders, token_packages, token_refund_requests, token_transactions, unlocks, user_roles, verification_requests.

**Manquant** :
- **Métier** : `missions`, `mission_tasks`, `mission_files`, `mission_events`, `favorites`, `disputes`
- **Sécurité** : `otp_verifications`, `verification_records`, `risk_events`, `risk_scores`, `audit_logs` (partiel : `admin_actions`), `feature_flags`
- **Comptes** : `agencies`, `agency_members`, `subscriptions`, `sponsored_profiles`, `sponsored_briefs`
- **Nommage** : `wallets`/`wallet_transactions` → `token_transactions`+`token_orders` (équivalent OK, à documenter) ; `payment_orders`/`payment_transactions`/`payment_events` → `payment_intents`+`payments` (équivalent OK)
- **Skills** : `skills`, `developer_skills`, `brief_skills` → `developer_services` (équivalent partiel)
- **Availability** : `developer_availability` absent

## 5. Ce qui est dangereux

1. **C1 + business** : incohérence pays affichés = expérience et SEO perdus pour 2 pays prioritaires.
2. **C4** : sans OTP, un numéro WhatsApp peut être revendiqué par un tiers → risque d'usurpation de contact.
3. **C6 + C7** : surface d'attaque API sans limitation ni garde centralisée.
4. **C9** : le cycle BRIEF → … → MISSION → REVIEW est interrompu : la valeur business principale n'est pas finalisée.
5. **IPN PayDunya** : le hash ne couvre pas le contenu (faiblesse connue du protocole) — la re-vérification montant côté serveur est **indispensable** et déjà en place, ne jamais la retirer.

## 6. Ce qui est améliorable

- Unifier les 2 apps (site/console) sur un socle commun de types et de guards.
- Centraliser les guards (`requireRole`) plutôt que par page.
- Interface `PaymentProvider` commune à PayDunya et Wave (l'abstraction n'existe pas : `lib/payments/paydunya.ts` et `wave.ts` exposent des fonctions indépendantes, `config.ts` décide du fournisseur).
- Ajouter `CHANGELOG.md` (§61) et `docs/DEPLOIEMENT.md` (fin de §66).

## 7. Architecture actuelle → cible

**Actuel** : site Next.js (Vercel) + console admin (Vercel) → Supabase (Postgres/Auth) → PayDunya/Wave → notifications externes.

**Cible (P0)** : ajouter OTP (provider SMS/WhatsApp + fallback), table `missions` avec machine à états transactionnelle, `audit_logs`, `otp_verifications`, `feature_flags`, rate-limiting, garde de route centralisée, validation `zod` systématique, logs structurés, `risk_events` minimal.

**Cible (P1)** : pages pays/villes (`/senegal`, `/dakar`…), favoris, support/tickets, analytics événements, TERANGA MATCH, notifications préférences.

**Cible (P2)** : IA (brief assistant), agences, sponsoring, abonnement PRO, TERANGA SCORE avancé.

## 8. Migrations nécessaires (ordre)

| # | Migration | Contenu | Bloquant ? |
|---|---|---|---|
| M1 | `0036_roles_client_support.sql` | rôles `client/agency/support/super_admin` | Oui (C3) |
| M2 | `0037_otp_verifications.sql` | table OTP + RPC request/verify + tentatives/expiration | Oui (C4) |
| M3 | `0038_missions.sql` | `missions` + états + `mission_events` + RPC transactionnelles | Oui (C9) |
| M4 | `0039_audit_logs.sql` | `audit_logs` + hooks sur actions admin | Oui (C7 audit) |
| M5 | `0040_feature_flags.sql` | `feature_flags` + lecture serveur | Non (§45) |
| M6 | `0041_favorites_disputes.sql` | `favorites`, `disputes`, `risk_events` | Non |
| M7 | `0042_availability.sql` | `developer_availability` | Non (§12) |

## 9. Risques

- **R1** — Régression sur les RPC financières : toute migration doit être non destructive et testée (`npm run test:db`).
- **R2** — Données existantes à préserver (§57) : migrations `IF NOT EXISTS` + `ALTER`, jamais `DROP`.
- **R3** — Clés PayDunya/Wave déjà en production : ne pas toucher à `.env` côté Vercel sans backup.
- **R4** — Deux apps à synchroniser (site + console admin).

## 10. Priorités

**P0 (indispensable au lancement)** — C1, C3, C4, C5, C6, C7, C9, C8, C14 (§58).
**P1 (croissance)** — C2, C10, C11, C12, C13.
**P2 (différenciation)** — IA, agences, sponsoring, abonnement.

---

## 11. Suivi des corrections (au 2026-10-08)

Tous les constats de §3 sont traités et poussés sur `main` (détail au `CHANGELOG.md`) :

| # | État | Livraison |
|---|---|---|
| C1 | ✅ | Libellé UEMOA corrigé (`lib/countries.ts`, `/pays`, landing) + tests `geography.test.ts` |
| C2 | ✅ | Pages `/ville`, `/pays` + sitemap régions (`region-slugs.ts`, tests dédiés) |
| C3 | ✅ | Migration `0036` : rôles `client`, `agency`, `support`, `super_admin` |
| C4 | ✅ | Migration `0037` + routes `otp/request`, `otp/verify` |
| C5 | ✅ | Schémas zod sur `payments/checkout`, `payments/status`, `verification/checkout` |
| C6 | ✅ | `lib/rate-limit.ts` appliqué aux routes sensibles (OTP, checkout, IA, favoris) |
| C7 | ✅ | P3-1 : `requireUser`/`apiRequireUser` centralisés (8 pages + 6 routes API) + anti-régression |
| C8 | ✅ | `lib/log.ts` : logs structurés (timestamp, action, request_id…) |
| C9 | ✅ | Migration `0038` : `missions` + machine à états + `mission_events` transactionnels |
| C10 | ✅ | Migration `0039` : `analytic_events` + `track_event` (service_role) |
| C11 | ✅ | `0040` favoris ; `0048` litiges + risque ; `0049` feature flags + disponibilités ; `0050` support (P4-1) + page `/support` (P4-2) |
| C12 | ✅ | Migration `0043` : TERANGA SCORE + TERANGA MATCH |
| C13 | ✅ | `/classement` dans le sitemap (`app/sitemap.ts`) |
| C14 | ✅ | P3-3 pgtap (RLS + surface anon + garde RPC) ; P3-4 E2E Playwright (10 tests) ; tests unitaires webhook/unlock existants |

**Éléments transverses livrés** : validations zod, rate-limiting, logs structurés,
CHANGELOG §61, `docs/DEPLOIEMENT.md` §66, CI complète (quality/build/db-tests/e2e/secrets),
verrouillage des privilèges SQL (`0047` — `debit_tokens` révoquée de PUBLIC), abstraction
`PaymentProvider`, tests E2E + SQL ajoutés à la CI.

**Restant hors périmètre site** : la console `teranga-labs-admin` (dépôt séparé, R4) —
elle consomme les mêmes RPC (service_role) et devra suivre l'évolution des tables
`disputes`, `support_*`, `feature_flags`.
