# Changelog

Toutes les modifications notables du projet sont documentées ici (§61 du cahier des charges). Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased] — 2026-10-26 : refonte de la landing « à la Codeur » (sections A → M)

Reproduction de la composition de codeur.com sur l'accueil public, en gardant l'identité Devmarket (bleu `#0B132B`, vert `#39FF88`, logo, thème sombre unique) et sans reprendre aucune marque, aucun chiffre ni aucun avis de Codeur.

### Composition (`app/[locale]/page.tsx`)

- **Nouvel ordre** : Hero → Projets récents → Drapeaux pays → Offres sur-mesure → Comment ça marche → Catégories/métiers → Avantages (`#tarifs`) → Plateforme → Pourquoi un freelance → Grand CTA → Confiance/témoignages → FAQ → Cartes de rôle, puis le footer.
- **Sections créées** (`components/landing/`) : `custom-offers.tsx`, `how-it-works.tsx` (parcours client/développeur), `categories.tsx`, `benefits.tsx`, `platform.tsx`, `why-freelance.tsx`, `big-cta.tsx`, `social-proof.tsx`, `faq.tsx`, `role-cards.tsx`.
- **Sections réécrites** : `hero.tsx` (cercles concentriques, avatars, titre souligné, recherche `/dev?q=`, chips), `latest-projects.tsx` (grille 2 colonnes, 8 projets, temps relatif localisé), `components/footer.tsx` (4 colonnes de liens réels + marque + newsletter + mentions).
- **Retirées du rendu** (fichiers conservés) : `stats-band.tsx`, `pricing.tsx`, `token-section.tsx`, `comparison-table.tsx`, `for-who-tabs.tsx`, `testimonials.tsx`. Leurs arguments (0 FCFA de publication, 1 Token côté développeur, 0 % commission) sont repris dans Avantages/Plateforme ; l'ancre `#tarifs` passe sur `Benefits`.

### Recherche et navigation

- **`/dev?q=` branché de bout en bout** : le paramètre est lu dans `app/[locale]/dev/page.tsx` (borné à 80 caractères), transmis à `list_approved_developers` (`p_query`) puis à `DirectoryPage` (`initialQuery`) — le hero, les 7 chips et les 24 métiers filtrent réellement l'annuaire.
- **Navbar visiteur** alignée sur la référence : Développeurs, Projets, Agences, Comment ça marche, Tarifs, FAQ + CTA ; menu mobile enrichi des mêmes entrées.

### Contenu honnête

- **Aucune donnée inventée** : les 8 projets affichent les vraies métadonnées quand Supabase est configuré, sinon des démos explicitement badgées « Démo » ; les 6 témoignages portent aussi le badge « Démo » et une note de bas de section ; les chiffres de la section Confiance sont des faits produit (périmètre, coût, délai), pas des volumes d'utilisateurs.

### Accessibilité et animations

- **Onglets de métiers** en pattern WAI-ARIA complet (flèches gauche/droite, Home/End, `aria-selected`, `tabIndex` géré) ; **FAQ** en accordéon fluide (`grid-template-rows` 0fr → 1fr, `aria-expanded`/`aria-controls`, deux colonnes clients/développeurs, premier item ouvert).
- **`app/globals.css`** : `hero-glow`, `hero-ring` (pulsation décalée par anneau) et `hero-underline` (tracé SVG animé), tous neutralisés sous `prefers-reduced-motion` ; cibles tactiles ≥ 44 px sur les CTA, `focus-visible` sur tous les liens/boutons — y compris un anneau vert sur les liens du menu principal, auparavant signalés par le seul changement de couleur. Le sélecteur FR/EN passe de 31 × 19 px à 28 × 28 px (minimum WCAG 2.5.8).
- **Hydratation** : `next-themes` retiré (`components/providers.tsx`) — le site n'a qu'un thème et son script injectait un `class`/`style` dans `<html>` avant l'hydratation, provoquant par intermittence une erreur React #418 et une régénération de l'arbre. Les toasts gardent leur apparence (`theme="light"` explicite). 15 chargements consécutifs sans erreur après correctif.

### i18n

- **`Landing.{hero,latestProjects,offers,process,categories,benefits,platform,why,bigCta,socialProof,faq,roleCards}`** et **`Footer.{columns,links}`** ajoutés/renforcés en FR et EN — parité vérifiée (458 clés de chaque côté, 0 écart). `formatRelativeTime` remplacé par `Intl.RelativeTimeFormat` dans les cartes projet pour un temps relatif correct dans les deux langues. Les 8 projets de démonstration sont traduits (`latestProjects.demos`), avec repli sur le français si une entrée manque.

## [Unreleased] — 2026-10-26 : espace développeur « à la Codeur » (stats + alerte email)

Suite de la refonte « Codeur » (publication de projet gratuite côté client, monétisation côté développeur) : l'espace développeur gagne le suivi de performance de sa fiche et une préférence d'alerte email.

### Statistiques de la fiche (D1)

- **Panneau « Performance du profil »** (`components/dev/performance-panel.tsx`) dans l'onglet Activité : vues de fiche, clics « Contacter », contacts ouverts et taux de conversion, sur 30 jours avec le total. Textes `DevStats` en FR/EN (parité 594 clés).
- **RPC `get_my_developer_stats()`** (migration `0070`) : agrège `analytic_events` (vues/clics) et les conversations directes (`request_id IS NULL`) créées par `contact_developer`. Lecture seule, `SECURITY DEFINER`, tolérante à l'absence de la table analytics.
- **Suivi** : `components/dev/profile-view-tracker.tsx` émet `profile_view` sur la fiche publique (visiteurs anonymes inclus), `contact-dialog.tsx` émet `contact_click` à l'ouverture du bouton « Contacter ». Une vue de sa propre fiche est ignorée, côté route et côté base.

### Alerte email « nouveaux projets » (D2)

- Colonne `notification_preferences.email_new_projects` (défaut `true`), case dédiée dans l'onglet Profil ; `lib/notifications/dispatch.ts` et `providers.ts` respectent la préférence (WhatsApp inchangé, absence de ligne = actif).

### Pain de la production corrigé au passage (D3)

- **`public.notification_preferences` n'existait pas en production** (migration `0067` jamais appliquée) : tous les réglages de notification échouaient silencieusement. La migration `0070` crée la table, ses policies RLS, le backfill `user_metadata.email_prefs` et le gating de `notify_user` (supprimé puis recréé, son type de retour en prod différant — `42P13`).
- **`SUPABASE_SERVICE_ROLE_KEY` absente sur Vercel** : `/api/analytics/track` sortait en `recorded:false`, et la newsletter, le webhook de paiement et l'envoi des notifications étaient inopérants. Migration `0071` : RPC `track_public_event()` (`SECURITY DEFINER`, `anon` + `authenticated`) limitée à `profile_view` / `contact_click` et à un développeur existant, la table restant fermée en écriture directe. Les statistiques ne dépendent plus de la clé service.

## [Unreleased] — 2026-10-23 : rebrand Devmarket (Prompt Blue + AI Green, logos officiels, slogan)

Le site change d'identité : **TERANGA LABS → Devmarket** — nom, logos, palette (Prompt Blue `#0B132B` en fond, AI Green `#39FF88` en primaire) et slogan « Find Developers. Build Your Vision ». Migrations, CHANGELOG et AUDIT exclus du renommage (historique immuable).

### Identité & logos (T1)

- **Logos officiels du client** (`logo avec nom.png` 1997×787 + `logo sans nom.png`, transparence d'origine conservée) : `public/logo.png` = lockup en **variante claire** (texte/contour marine `#000920` + halo gris → `#F1F5FF`, verts et blancs intacts — le lockup marine d'origine serait illisible sur le fond sombre du site) ; `public/icon.png` (512), `public/apple-icon.png` (180), `public/pwa-icon-192/512.png` et `public/favicon.ico` (conteneur ICO, entrée PNG 32×32) dérivés du pictogramme marine d'origine ; `public/og.png` 1200×630 (radial Prompt Blue + lockup clair centré) ; `components/logo.tsx` : dimensions réelles 1997×787.
- **Capture écran du laptop hero** : `public/hero/briefs-desktop.png` régénérée (1280×800 sur `/briefs`) — l'écran du héros affiche maintenant Devmarket en bleu nuit au lieu de l'ancienne maquette noire/orange.

### Palette Prompt Blue + AI Green (T2)

- **`app/globals.css`** : fond `#0b132b`, primaire `#39ff88` + jetons dérivés (ink, surfaces, hairlines, primary-soft/light/hover, success) ; teintes translucides déjà en `color-mix()`.
- **Hardcodes résiduels convertis** : `global-error.tsx`, `themeColor` racine, gradients hex de `scene-3d`, halos `hero`/`navbar`/`client-shell` ; textes sur aplat néon `text-white` → `text-ink` (FAB, filtres, avatars, nav — 13,9:1).
- **6 illustrations SVG** (`public/illustrations/`) recolorées (marque + neutres de l'ancienne palette chaude).
- **README** : table du design system et note de contraste recalculées.

### Slogan (T3)

- Clés i18n `Landing.hero.slogan` + `Footer.slogan` (« Find Developers. Build Your Vision », identique FR/EN) rendues sous le h1 du hero et au-dessus de la tagline du footer.

### Renommage Devmarket (T4-T5)

- **~250 occurrences sur 64 fichiers** : UI, i18n FR/EN, metadata (template de titre, siteName, JSON-LD), e-mails/OTP, mentions légales/CGU, README, docs ; contact → `contact@devmarket.com`.
- **Identifiants préservés** : colonne `via_teranga_labs`, RPC `teranga_match` (+ types), projets Vercel `teranga-labs`/`teranga-labs-admin`, URL de repli `teranga-labs.vercel.app`, domaine d'envoi Resend (display name « Devmarket »).
- **Features** : `TerangaMatch` → `DevmarketMatch` (`components/briefs/devmarket-match.tsx`), « Score Teranga » → « Score Devmarket », clés de colonnes `teranga` → `devmarket` (tableau comparatif + messages).
- **`package.json`** : nom `devmarket` (lock régénéré).

### Correctifs metadata (bonus)

- **`Meta.ogAlt` manquante** (bug préexistant de la refonte : `MISSING_MESSAGE` à chaque rendu de la home) : clé ajoutée en FR/EN ; `og:title`/`twitter:title` de la home basculés sur `Meta.ogTitle` ; « | Devmarket » retiré de `Meta.title` (fin du « … — Devmarket » dupliqué dans le `<title>`).

### Vérifications

- `npm run check` ✓ (check-rpc, typecheck, lint, **177/177** vitest) ; `npm run build` ✓ (FLJS 304 kB) ; **e2e smoke+landing 22/22** ; résidus « teranga » limités aux identifiants DB/projets volontairement conservés.

### Correctif build Vercel (fonts auto-hébergées)

- **`next/font/google` → `next/font/local`** : les 4 familles (Outfit, Bodoni Moda italique, DM Sans, Geist Mono) sont embarquées en woff2 latin variable dans `app/fonts/` (~172 kB). Correction du bug upstream vercel/next.js#99114 (Google Fonts répond ~1-2 % du temps des URLs sans extension que Turbopack ne parse pas → **build Vercel en échec aléatoire**, cause des déploiements prod non venus) ; zéro appel réseau au build, rendu identique (mêmes axes variable et variables CSS).

## [Unreleased] — refonte complète TERANGA LABS (38 points, sections A → H)

Lot complet du plan de refonte à 38 points : **A** SEO/corrections, **B** landing niveau mondial, **C** performance, **D** accessibilité, **E** sécurité, **F** fonctionnalités user, **G** notifications, **H** drapeaux/paiement/doc — sans changer le design existant (mobile-first, next-intl FR/EN).

### Corrections urgentes (A)

- **Placeholder `{token}` figé** : la variable de traduction non résolue `1 Token = {token}` devient `1 Token = 2 500 F` (FR) / `1 Token = 2,500 F` (EN) ; `{name}` (ICU) est préservé côté success.
- **Mentions légales** : FR/EN nettoyées des placeholders `[à compléter]` / `[to be completed]`.
- **Tri `/dev` i18n** : `dev/directory-page.tsx` utilise `useTranslations("Directory")` et le trigger affiche le libellé i18n (clés `Directory.sort.*` ajoutées) au lieu de la valeur brute.
- **Favicon** : `public/favicon.ico` en source unique (les routes `app/icon.png` et `app/favicon.ico` redondantes supprimées), metadata `icons` nettoyée dans `app/layout.tsx`.
- **Canonical + hreflang globaux** : helper `buildAlternates()` (`lib/utils.ts`) + header `x-pathname` posé sur la **requête** dans `middleware.ts` (avant `handleI18nRouting`) ; `generateMetadata` du layout racine renvoie `alternates` avec `fr`/`en`/`x-default` cohérents sur toutes les routes publiques.
- **og:image / twitter:image** : homepage renseigne `og:image` et `twitter:image` (`/og.png` 1200×630, alt i18n).

### Landing niveau mondial (B)

- **Nouvelles sections** (`components/landing/`) : `social-proof.tsx`, `token-section.tsx`, `comparison-table.tsx` (TERANGA vs groupes WhatsApp vs plateformes étrangères), `for-who-tabs.tsx` (tabs WAI-ARIA au clavier), `testimonials.tsx` (contenu démo, à remplacer) et `country-flags.tsx` (9 pays du périmètre, codes ISO2 majuscules, `getFlagUrl`).
- **CTA sous-texte** : `Landing.hero.ctaNote` rendu sous le hero.
- **Nav visiteur** : lien « Développeurs / Developers » → `/dev` dans la navbar publique, avec état actif (`isActiveLink`).
- **Newsletter (B16)** : table `newsletter_subscribers` (migration `0066`, RLS insert anonyme, RPC upsert idempotent + `admin_list_newsletter_subscribers`), route publique `POST /api/newsletter` (rate-limitée, réponse `ok` même si déjà inscrit — pas de disclosure), composant `newsletter-form.tsx` dans le footer (labels + `role="status"`).
- **Réseaux sociaux (B17)** : `social-links.tsx` (icônes SVG inline, URLs via `NEXT_PUBLIC_*_URL`, rendu vide si absentes — aucun lien mort).
- **i18n** : clés `Landing.{socialProof,token,comparison,testimonials,forWho,flags}`, `Landing.hero.ctaNote`, `Footer.newsletter`, `Footer.social`, `Nav.developers` ajoutées en FR et EN.

### Performance & images (C)

- **Formats modernes** : `next.config.ts` → `images.formats = ["image/avif", "image/webp"]` (conversion automatique des images servies par `next/image`).
- **`Flag`** : attribut `sizes` explicite sur chaque variante d'image (fini le chargement de la pleine largeur sur mobile).

### Accessibilité (D)

- **Skip link** : `components/skip-link.tsx` (libellé i18n `skipToContent` → `#main`) + `id="main" tabIndex={-1}` sur les 3 shells (`site-shell`, `client-shell`, `dashboard-shell`) — le focus atterrit sur le contenu.
- **Contrastes** : opacités faibles remplacées par des couleurs pleines (5× `/70`, 3× `placeholder:/60`).
- **`CountryRegionSelect`** : thème sombre harmonisé + `htmlFor`/`id` liant label et champ.
- **`role="alert"` + `aria-describedby`** : `contact-form`, `agency-manager` (6 champs), `newsletter-form` (`aria-invalid` + `id="newsletter-status"`).
- **Structure** : `h2 sr-only` sur `role-cards` (`t("client.title")`), `<h3>` sur les résumés FAQ, logo en `alt=""`, `focus-visible` sur les champs du formulaire agence.

### Sécurité (E)

- **Headers centralisés** : `middleware.ts` devient le seul maître des headers de contenu — CSP riche (`frame-ancestors 'none'; base-uri 'self'; form-action 'self'` + Supabase), Permissions-Policy avec `payment=()`, HSTS ; `next.config.ts` ne garde que HSTS (couvre les statiques hors matcher).
- **Disclosure Postgres close** : `api/admin/leaderboard/settle`, `api/cron/leaderboard-settle` et `api/otp/request` renvoient des codes applicatifs génériques (log interne seul) ; comparaison cron en temps constant (`timingSafeEqual`) ; bornes `year` 2000-2100 ; caractères parasite `透露` corrigé.

### Fonctionnalités user (F)

- **Page `/favoris` (F1)** : `app/[locale]/favoris/page.tsx` (requireUser, embedding `favorites → requests` avec les colonnes brief), grilles/empty-state/favori réutilisés, clés i18n `Pages.favorites` (ICU `count`, FR/EN), lien **Cœur** ajouté aux navs app + client (`app-nav.ts`, `SHELL_SEGMENTS`).
- **Litiges côté user (F2)** : `missions-dashboard.tsx` appelle `open_dispute` avant `mission_update_status` quand la cible ∈ {`dispute_open`, `disputed`} (déjà ouvert = non bloquant), nouvelle section **« Mes litiges »** (badges `open|under_review|resolved|rejected` + lien `/missions/{id}`) alimentée par `list_my_disputes` depuis `/missions` ; les deux RPCs ajoutées à `types/database.ts`.
- **Analytics (F3)** : `signup_completed` fire-and-forget dans `/auth/confirm` (type `signup`) ; route `POST /api/analytics/track` (apiRequireUser, rate-limit 60/IP, `track_event` service_role) + `trackClientEventSchema` (`contact_unlocked`) appelée par `unlock-dialog` après déblocage réussi.
- **Sitemap (F4)** : `/agences` (statique) + fiches agences (`list_agencies`) ajoutées ; vérification faite que les pages pays/villes sont bien indexables (le `noindex` repéré ne concerne que le cas « introuvable »).

### Notifications & préférences (G)

- **Mig `0067` `notification_preferences`** : table (`in_app` + 4 préf. e-mail) avec RLS « chacun le sien », **backfill** depuis `user_metadata.email_prefs`, et `notify_user` remplacée : plus d'insertion in-app si `in_app = false` (**absence de ligne = actif** : comportement historique préservé).
- **Écran Paramètres** : lecture depuis la table (fallback `user_metadata`), persistance par `upsert` (défaut `auth.uid()`), nouvel interrupteur **« Notifications dans l'app »** ; `user_metadata.email_prefs` n'est plus écrit côté client.

### Feature flags & paiement (H)

- **H1 — premier drapeau branché** : helper `lib/features.ts` (`isFeatureEnabled`, défaut `false`) + gate sur `POST /api/newsletter` (drapeau éteint → `404`, **avant** le rate-limit) ; seed `newsletter = true` (mig `0068`) pour ne rien casser ; commutable sans redéploiement via `admin_set_feature_flag`.
- **H2 — abstraction `PaymentProvider`** : `lib/payments/provider.ts` (contrat : checkout, re-vérification de la vente, montant, référence, signature webhook, `isPaymentApiError`) + `lib/payments/chariow-provider.ts` (adaptateur, délégation pure vers `chariow.ts`) ; les 4 routes (`payments/checkout`, `payments/mission-checkout`, `verification/checkout`, `payments/webhook`) basculées dessus — plus aucune dépendance directe au module `chariow` côté routes.
- **H3 — doc** : `docs/DEPLOIEMENT.md` nouvelle §8 (drapeaux de fonctionnalité + préférences de notifications), §3 mise à jour (ordre des migrations `0001 → 0068`).

### Vérifications (A → H)

- `npm run check` ✓ (check-rpc : 173 appels RPC tous résolus, typecheck, lint, vitest **177/177**), `npm run build` ✓ (First Load JS 304 kB ; routes `analytics`, `newsletter`, page `favoris` en place), e2e port 3100 : **58/63 en suite complète** — les 5 échecs (navbar/3D/tarifs landing, home guards, smoke header) sont des **flakes de charge** (scénarios à 43-56 s), **26/26 au rejeu** des 3 fichiers concernés.
- **À faire en prod** : appliquer les migrations `0066`, `0067` et `0068` dans le SQL Editor ; renseigner `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `CHARIOW_MISSION_PRODUCT_ID` et les URLs sociales `NEXT_PUBLIC_*_URL`.

## [Unreleased] — 2026-10-21 : bandeau noir supprimé de l'espace client et de l'espace développeur

La navbar publique noire (Trouver un développeur, Agences, Accueil, Messages, Missions, Publier un brief, Acheter des Tokens, Paramètres, FR/EN, cloche, solde, profil, déconnexion) n'apparaît plus dans les espaces connectés client et développeur.

- **`SiteShell`** : le rôle **client** obtient `ClientShell` sur **toutes** ses routes (porte par liste de routes retirée), le rôle **developer** obtient `DashboardShell` sur **toutes** ses routes (notifications, support, classement… étaient hors liste et affichaient la navbar) ; les autres rôles (visiteur, admin…) sont inchangés. La navbar fixe (`fixed inset-x-0 top-0 z-50`) et sa marge `main pt-16` ne s'appliquent plus à ces espaces : le contenu commence en haut, sans espace vide (les pages gardent leur propre rythme `py-16`).
- **Navigation préservée** dans les sidebars/tiroirs : sidebar client complétée avec **« Publier un brief »** (`/poster`) et **« Agences »** (`/agences`) — Catalogue (`/dev` = Trouver un développeur), Mes projets, Mes briefs, Messages, Mon wallet, Paramètres, profil, cloche, solde de Tokens et déconnexion y figuraient déjà ; côté développeur, les sections (Accueil, Agences, Missions, Briefs, Messages, Mon profil, Mon wallet, Paramètres) + cloche + solde + déconnexion couvrent l'ancienne navbar.
- **Sélecteur FR/EN déplacé** : extrait de `navbar.tsx` vers `components/language-switcher.tsx` (partagé) et ajouté au bloc profil des deux shells (sidebar basse sur ordinateur, tiroir sur mobile) — le changement de langue reste accessible.
- **Nettoyage** : `components/client/app-routes.ts` supprimé (liste de routes morte après la suppression de la porte) ; `globals.css` et les autres layouts vérifiés (aucune règle sticky/fixed résiduelle, seul `Navbar` porte `fixed top-0`).
- **Vérifications** : `npm run check` ✓ (177/177), build ✓, e2e **63/63** (le smoke header a montré un flake de timing en suite complète, vert en solo et au passage suivant — aucune régression visiteur : la navbar publique est intacte pour les non connectés).

## [Unreleased] — 2026-10-21 : inscription monde + devises locales, accueil dev refondu, profil, messagerie, classement mondial

Lot des dernières demandes utilisateur : inscription ouverte aux ~206 pays du monde avec devises locales, accueil de l'espace développeur refondu, profil assoupli et partageable, messagerie enrichie, classement mondial et escrow automatique.

### Inscription monde + devises locales

- **`lib/world-countries.ts`** (nouveau) : 206 pays (Afrique 54, Asie 49, Europe 46, Amériques 41, Océanie 16) avec nom FR, indicatif et devise ; `WORLD_PHONE_COUNTRIES` déduplique les indicatifs partagés (+1 US/CA, +7 RU/KZ → ≈ 204 options), `parseWorldDial` gère `+`, `00` et le sans-préfixe (+221 par défaut), régions curées pour ~44 pays (`getWorldRegions`) ; les 9 pays du périmètre restent servis par `lib/countries.ts` (**inchangé** : `/ville`, `/pays`, briefs).
- **`lib/currency.ts`** (nouveau) : taux statiques indicatifs ancrés USD (~110 devises, pegs EUR/XAF/XPF/BGN/BAM/DKK/NAD…), `convertFcfa`, `formatLocalPrice` (Intl, locale fr-FR), `isKnownCurrency`.
- **Inscription client et développeur** : sélecteur de pays du monde (ISO2 en UI, **nom FR** stocké — `users.country` groupe le classement par nom), région conditionnelle (Select si le pays a des régions curées, champ libre sinon ; ville legacy hors liste préservée en champ libre), ordre Pays → Région → Adresse ; `cityField()` (2–60 car.) remplace `regionField` pour l'inscription, `regionField` strict conservé pour `briefSchema.client_city`.
- **`PhoneInput`** : tous les indicatifs du monde (drapeau par ISO2), aria-label inchangé.
- **Wallet** : `TokenCard` affiche le prix local « ≈ X · taux indicatif » sous le prix FCFA (devise depuis le profil développeur, sinon `user_metadata.country` ; masqué en XOF).
- **Tests** : `tests/world-countries.test.ts` (+20 : unicité ISO2/noms, tri FR, cohérence du périmètre, dials, régions, conversions) ; e2e `multipays.spec.ts` : toutes les options d'indicatif sont proposées.

### Espace développeur

- **Accueil `/dashboard` refondu** : sous-titre dynamique (Tokens disponibles · contacts débloqués · missions en cours), raccourci « Acheter des Tokens » (`/wallet#acheter-tokens`), carte **« Profil X % complet »** (barre de progression + puces de critères, photo et portfolio comptés comme recommandations) avec retour à l'onglet profil ; aucun décor 3D dans l'espace dev.
- **Photo de profil** : libellé « optionnelle, recommandée » (inscription) et critère de recommandation du profil.
- **Portfolio** : libellés « (optionnel, recommandé) » (dashboard et inscription).
- **Profil public** : bouton **Partager** (`ShareProfileButton` : Web Share API puis presse-papiers, URL rendue absolue) à côté de « Voir mon profil public » (gateé par l'identifiant public) dans le dashboard et les paramètres.
- **Agence** : coût **4 Tokens** affiché sur « Créer mon agence » et message de solde insuffisant renvoyant au wallet.
- **`/dev`** : redirection vers `/dashboard` qui préserve la locale (next-intl `getLocale`).

### Messagerie & notifications

- Message vocal (envoi + piste de lecture), édition et suppression douce des messages ; présence en ligne / « vu il y a … » ; cloche de notifications couvrant tous les types (`lib/notification-icon.ts`).

### Paiement

- Énumérations de moyens de paiement retirées de la copy marketing (landing, tokens, messages FR/EN) ; les sélecteurs fonctionnels sont conservés (choix du moyen de paiement de la vérification, choix du canal de retrait).

### Classement & escrow

- **Migration `0065_escrow_auto_refund_leaderboard.sql`** : remboursement automatique du fonds bloqué en cas d'annulation/refus (bookkeeping plateforme, Chariow n'exposant pas d'API refund), réglage du cron sur le **mois précédent**, **50 pts** par projet livré (région + pays), top 3 = 10/7/4 (détails des contrats inchangés).
- **`/classement`** : classement **mondial** (tous les pays) en plus des classements régional et par pays.
- Route cron `/api/cron/leaderboard-settle` (secrète via `CRON_SECRET`) qui solde le mois précédent.

### Vérifications exécutées

- `npm run check` ✓ (check-rpc, typecheck, lint), unitaires **177/177**, e2e **63/63**.

### Interventions requises de l'utilisateur

1. Appliquer `supabase/migrations/0065_escrow_auto_refund_leaderboard.sql` dans le SQL Editor (ou la section 0065 du script consolidé).
2. Configurer `SUPABASE_SERVICE_ROLE_KEY` (vide en local : le webhook de paiement répond 503).
3. Le remboursement « auto » est un bookkeeping plateforme : à suivre côté comptable (pas d'API refund Chariow).

## [Unreleased] — 2026-10-20 : paiement Chariow des missions (client → montant convenu)

Le client peut désormais régler une mission en ligne au montant exact convenu ; la confirmation ne vient que du Pulse signé (aucun crédit côté client).

### Paiement de mission

- **`POST /api/payments/mission-checkout`** (nouvelle route, `apiRequireUser`, rate-limitée) : vérifie que l'appelant est le **client** de la mission et que son statut est `awaiting_payment`, ouvre une session Chariow avec le produit `CHARIOW_MISSION_PRODUCT_ID` (ou `app_settings.mission_product_id`) + la **variante de prix** correspondant à `agreed_price_fcfa` (`app_settings.mission_price_variants` : `{"15000":"pvr_…"}`). Sans variante pour ce montant → 503 `MISSION_PRICE_NOT_AVAILABLE` (jamais de montant approché). Montant renvoyé par Chariow re-vérifié immédiatement (variante inconnue ignorée côté prestataire → refus 409 avant redirection).
- **`createChariowCheckout`** : paramètre `price_variant_id` (doc API Chariow : variante de prix pour tarification unique) + restitution du `amount` réel de la vente dans le résultat ; `getPulseReference` accepte `kind: "mission"`.
- **Webhook Pulse** : branche `kind === "mission"` → re-vérification serveur `GET /sales/{id}`, contrôle strict du montant (`amountMatchesSale`), puis RPC **`confirm_mission_payment`** (service_role, idempotent) + tracking `pulse_chariow_mission`.
- **UI `missions-dashboard`** : bouton « Payer X FCFA » pour le client en `awaiting_payment` (composant partagé `MissionPayButton`, redirection vers `checkout_url`, retour sur `/missions/:id?paid=1`) ; la transition manuelle « Paiement confirmé » est retirée de `MISSION_TRANSITIONS` (déjà interdite par `mission_update_status` : seul le webhook confirme).
- **Page détail `/missions/:id`** (nouvelle) : même garde `requireUser` que la liste, mission chargée via `list_my_missions` (RLS) et `notFound()` si absente ; montant, délai, description, partie adverse, historique complet et bouton « Payer ». Entrées : titre de carte cliquable + lien « Détail » sur `/missions`, lien « Suivre la mission » de la messagerie → `/missions/:id`.
- **Config** : `CHARIOW_MISSION_PRODUCT_ID` documentée dans `.env.example` ; `app_settings` ajouté aux types ; route inscrite dans `tests/route-guards.test.ts`.
- **Migration 0064_mission_payment_settings.sql** : seeds `mission_product_id` (`''`) + `mission_price_variants` (`{}`, jamais écrasés) et RPC admin **`admin_get_mission_payment_config`** / **`admin_set_mission_payment_config`** (service_role ou `is_admin()`, validation stricte du produit `[A-Za-z0-9_-]{1,128}` et des variantes : clé numérique 1..100000000, valeur identifiant, 500 max, audit `admin_actions`). Ajoutées au script consolidé `docs/UPGRADE_0056_0063.sql` et aux types `Functions`.
- **Tests** : +1 (`price_variant_id` envoyé au checkout, métadonnées `kind: mission`) ; e2e **`e2e/mission-payment.spec.ts`** (sans session : checkout → 401, corps invalide → 400, Pulse non signé → 401/503, `/missions/:id` → `/login` ; aucune écriture Supabase, sous le rate-limit de 10 req/min).

### Vérifications exécutées

- typecheck ✓, lint ✓, unitaires **157/157**, e2e **63/63**.

### Interventions requises de l'utilisateur

1. Créer dans la boutique Chariow un produit (type Licence, prix XOF) + les **variantes de prix** pour chaque montant de mission négociable.
2. Appliquer `supabase/migrations/0064_mission_payment_settings.sql` (ou la section 0064 de `docs/UPGRADE_0056_0063.sql`) dans le SQL Editor.
3. Configurer la config de paiement : `CHARIOW_MISSION_PRODUCT_ID` + `app_settings.mission_price_variants`, ou RPC `admin_set_mission_payment_config` (console admin à venir).

## [Transformation-16-Etapes] — 2026-10-20 : refactor complet (wallet, missions, retraits, notifications, sécurité)

Chantier de transformation complet du produit : 8 migrations SQL (0056-0063), refonte wallet/missions/retraits/notifications, correction des failles de sécurité F1-F11, tarification alignée sur le cahier des charges.

### Base de données (migrations 0056-0063)

- **0056_security_hardening.sql** : triggers de protection sur `developers`/`client_profiles` (F1 : `phone_verified`/`status`/`is_verified`/réputation non modifiables par l'utilisateur), policies INSERT restreintes sur `payments`/`verification_requests`/`payment_intents` (F2/F6/F7 : statut forcé à `pending`), triggers de protection sur `conversations`/`formal_offers` (F4/F5 : seuls les RPC définer peuvent modifier), `publish_brief` réécrit avec vérif rôle client (F8), `get_leaderboard` en lecture seule (STABLE, mois clos sans écriture), `_leaderboard_settle` réécrit (récompenses **10/7/4**, pays sans double reward, `pg_advisory_xact_lock`, idempotent), `verify_otp` réécrit avec `user_id = auth.uid()` (F11).
- **0057_messaging_v2.sql** : colonnes `messages` `edited_at/deleted_at/audio_path/audio_duration_seconds`, bucket storage `message-audio` privé, trigger `protect_messages_update`, table `user_presence`, RPCs `touch_presence`, `get_peer_presence`, `send_message` (text/audio), `edit_message`, `soft_delete_message`, `mark_conversation_read`, `get_message_audio_url`.
- **0058_public_profile.sql** : colonne `developers.is_public`, RPC `get_public_profile_completion` (4 critères serveur), `set_public_profile`, `get_public_developer_profile` réécrit (filtre `is_public`), `list_approved_developers` réécrit.
- **0059_earnings_withdrawals.sql** : tables `mission_payments`, `earnings_ledger`, `withdrawals`, RPCs `confirm_mission_payment`, `release_mission_funds`, `get_wallet_summary`, `request_withdrawal`, `admin_withdrawal_status`, `get_wallet_history`.
- **0060_missions_full_flow.sql** : 15 statuts de mission, contrat snapshot, `create_mission_from_offer` réécrit, `mission_update_status` réécrit (machine à états complète), `mission_submit_delivery`, `mission_request_cancellation`, `admin_process_mission_refund`.
- **0061_leaderboard_settle.sql** : `leaderboard_settle_month`, configuration récompenses 10/7/4.
- **0062_notifications_v2.sql** : triggers sur `missions`/`token_transactions`/`earnings_ledger`/`withdrawals`/`subscriptions`/`payment_intents` → notifications in-app automatiques.
- **0063_pricing_space_cleanup.sql** : `pro_price_tokens=3`, `agency_price_tokens=4`, `create_agency` réécrit avec débit 4 tokens, sponsoring `REVOKE` pour authenticated.

### Frontend

- **Wallet centralisé** : pages `/wallet` (solde Tokens, revenus en attente/disponibles/retens/versés, historique) et `/wallet/retraits` (formulaire de demande de retrait), composants `WithdrawalForm`.
- **Navigation** : liens « Vérifier mon profil » et « Trouver un développeur » supprimés de l'espace dev, « Acheter des Tokens » remplacé par « Mon wallet » dans les deux espaces.
- **Dashboard** : `SponsorPanel` supprimé de l'onglet activité, upsell vérification supprimé du `DevStatusBanner` (statut `active`).
- **Footer** : masqué dans `DashboardShell` (espace connecté développeur).
- **Scene3D** : supprimé de `/tokens` et `/agences`.
- **Classement** : récompenses 10/7/4 (régional + pays), FAQ FR/EN mises à jour (« top 3 » au lieu de « top 2 »).
- **Cron** : `vercel.json` avec `/api/cron/leaderboard-settle` (mensuel, jour 1, 01h UTC), route API protégée par `CRON_SECRET`.
- **CI** : indentation `db-tests` corrigée, mojibake réparée.
- **Types** : `types/database.ts` étendu (4 tables + 17 RPCs), `MissionStatus`/`MessageType` mis à jour, `mission-labels.ts` réécrit pour les 15 statuts.

### Vérifications exécutées

- typecheck ✓, lint ✓, check-rpc-names ✓ (156 RPC), unitaires **156/156**.
- Script consolidé `docs/UPGRADE_0056_0063.sql` (107 Ko) prêt pour le SQL Editor Supabase.

### Interventions requises de l'utilisateur

1. **Appliquer les migrations 0053-0055** si non faites (voir CHANGELOG précédent).
2. **Appliquer le script consolidé** `docs/UPGRADE_0056_0063.sql` dans le SQL Editor Supabase.
3. **Configurer `CRON_SECRET`** dans Vercel (environnement Production) pour le settle du classement.
4. **Configurer `SUPABASE_SERVICE_ROLE_KEY`** dans Vercel (vide actuellement) pour le webhook de paiement.

## [Internationalisation-CP3] — 2026-10-19 : pages statiques traduites en anglais + metadata racine localisées

Suite directe du chantier i18n (CP1 structure, CP2 navbar/footer/landing) : les 8 pages statiques publiques passent en bilingue et les metadata par défaut du site suivent la locale.

- **8 pages traduites** (`/faq`, `/a-propos`, `/contact`, `/plan-du-site`, `/mentions-legales`, `/conditions-utilisation`, `/cookies`, `/politique-de-confidentialite`) : chacune passe de `export const metadata` à `generateMetadata()` via `getTranslations("Pages.*")`, le corps est piloté par messages (listes via `t.raw`, textes via `t()`, interpolation ICU `{token}`/`{tokenRule}` conservant `TOKEN_LABEL_PRICED`/`TOKEN_RULE`), et les liens internes passent de `next/link` au `Link` de next-intl (le préfixe `/en` est préservé — avant, un lien EN atterrissait sur la version FR).
- **Corps légaux en ICU rich text** : helper `i18n/legal.tsx` (`getLegal(ns)`) qui rend les tags des messages (`p`, `strong`, `it`, `ul`, `li`, `mail` = mailto, `privacy`/`cookies` = liens internes i18n, `vercel` = lien externe) — les 4 documents légaux (10/12/9/5 sections) vivent intégralement dans `messages/*.json`. `LegalPage` reçoit désormais la phrase complète de mise à jour (« Dernière mise à jour : 24 septembre 2026 » / « Last updated: September 24, 2026 ») au lieu d'un libellé codé en dur.
- **Formulaire de contact traduit** (`components/contact-form.tsx`, client) : labels, placeholders, objets, erreurs et messages de succès via `useTranslations`, avec interpolation `{name}` ; les valeurs envoyées au RPC (`submit_contact_message`) restent les libellés FR stables (`DB_SUBJECTS`) pour ne pas changer le contrat base de données.
- **Metadata racine localisées** (`app/layout.tsx`) : `export const metadata` devient `generateMetadata()` sur `RootMeta` — FR reprend byte-identique les anciennes valeurs (titre par défaut, description, 17 keywords, OG, Twitter), EN traduites ; `og:locale` et `og:url` suivent la locale (`/en` pour EN). Les JSON-LD Organisation/WebSite sont construits dans le composant : descriptions et noms de pays via `RootMeta`, `knowsLanguage` / `availableLanguage` / `inLanguage` = locale de la requête (mécanisme identique à l'`<html lang>` existant, aucun coût dynamique nouveau — le layout attend déjà les cookies).
- **Volontairement hors périmètre (RESTE EN FR)** : metadata des pages applicatives sous `[locale]` (titre/description propres), `app/not-found.tsx` (partagé, sans accès i18n), le manifest, les pages de données publiques (`/classement`, `/pays`, `/ville`, `/agences`, `/dev`), les pages d'authentification et le chrome applicatif — périmètre du prochain checkpoint si souhaité.
- **Vérifications exécutées** : typecheck ✓, lint ✓, build prod ✓, script CP3 **81/81** (9 pages FR byte-identiques vs snapshot baseline — titre, description et texte visible identiques après décodage des entités —, 8 pages EN avec contenus EN présents et FR absents, metadata racine FR/EN : keywords, og:locale, og:title, JSON-LD `inLanguage`/`knowsLanguage`), script FR/EN CP2 **53/53**, structure CP1 **20/20**, `accept-language` **6/6**, switcher interactif **10/10**, e2e **58/58**, régressions dashboard **49/49**, espace client **40/40**, dark-only **15/15**, logo **11/11**, **156/156** unitaires.

## [Internationalisation-FR-EN] — 2026-10-19 : site bilingue (next-intl, `/en` préfixé), navbar / footer / landing traduits, switcher de langue

Décision projet : « vision internationale » — le français reste la locale par défaut (sans préfixe), l'anglais est servi sous `/en`, la détection automatique (cookie + `accept-language`) est **désactivée** pour que la locale concluante soit toujours l'URL (sans cela, Playwright en `en-US` — et tout visiteur anglophone — serait redirigé vers `/en`). Périmètre volontaire : **pages publiques traduites en premier**, l'espace applicatif (pages, menus `app-nav.ts`) reste en français.

- **Fondations (checkpoint structurel)** : `i18n/routing.ts` (`as-needed`, `defaultLocale: "fr"`, `localeDetection: false`), `i18n/request.ts` (fallback via `requestLocale`), `i18n/navigation.ts` (`Link`/`usePathname`/`useRouter` préservant la locale), `messages/fr.json` + `messages/en.json`, plugin `createNextIntlPlugin` dans `next.config.ts`.
- **Routes délimitées** : les 30 dossiers de pages (dont `app/page.tsx`) sont déplacés sous `app/[locale]/` ; restent à la racine : `api/`, `admin/`, `layout.tsx`, `error`/`global-error`/`not-found`, `globals.css`, `robots.ts`, `sitemap.ts` et les icons. `app/[locale]/layout.tsx` valide la locale (`hasLocale` → `notFound()`) ; le `NextIntlClientProvider` (locale + messages via l'en-tête `x-next-intl-locale`) vit dans le **layout racine** pour couvrir aussi les 404 hors branche `[locale]`.
- **Middleware (composition validée)** : `refreshSession` d'abord (mutation des cookies de la requête), puis `handleI18nRouting` **uniquement** hors `/api` et hors fichiers pointés (sinon `/robots.txt` etc. seraient réécrits), copie des cookies Supabase sur la réponse, puis headers de sécurité. Les redirections `next.config` s'exécutent avant l'i18n (ordre Next : headers → redirects → middleware).
- **Navbar traduite + switcher** : `components/navbar.tsx` passe intégralement par `useTranslations("Nav")` (37 clés, libellés FR byte-identiques) et le `Link` de next-intl remplace `next/link` (les liens EN préservent la locale : `/en/dev` au lieu de `/dev`). Correctif de l'indicateur desktop (`measure`) qui lisait le href du DOM préfixé `/en`, incompatible avec `pathname` strippé. **Switcher FR/EN** compact (pastille courante + lien cible avec `hrefLang`/`lang`) dans le cluster desktop ET le menu mobile, en **navigation complète** (`preventDefault` + `location.assign`) : le layout racine (provider) ne se re-rend pas en navigation client, seul un rechargement serveur applique la nouvelle locale partout — sans cela, un clic laissait navbar et footer en français pendant que le hero passait en anglais.
- **Footer traduit** : `components/footer.tsx` via `useTranslations("Footer")` (tagline, 3 colonnes, liens juridiques, copyright), `Link` i18n, structure à 3 `nav` conservée.
- **Landing traduite** : `hero`, `how-it-works`, `pricing`, `faq`, `role-cards` via `useTranslations("Landing.*")` (étapes, cartes tarifs, 5 FAQ avec interpolation ICU `{token}`, cartes rôles) ; `generateMetadata` localisé sur `app/[locale]/page.tsx` (title/description/keywords/OG/Twitter selon `Meta`) et JSON-LD `inLanguage` + FAQ traduits.
- **Volontairement non traduit (périmètre)** : chrome applicatif (`app-nav.ts`, shells, drawers — vérifié FR par les scripts), pages statiques `/faq` `/a-propos` `/contact` `/plan-du-site` et pages légales, textes décoratifs des scènes 3D (`scene-3d`, clavier `hero-laptop`), metadata racine (l'anglais reste à étendre avec la traduction des pages statiques), copies P2P inchangées.
- **Vérifications exécutées** : typecheck ✓, lint ✓, build prod ✓, script FR/EN **53/53** (hero/nav/footer/switcher/JSON-LD/metadata dans les deux langues + régression routes), script interactif switcher **10/10** (clic FR→EN→FR complet avec 307 `/fr`→`/`, switcher mobile), structure CP1 **20/20**, `accept-language` **6/6** (visiteur `en-US` reste en FR), e2e **58/58**, régressions dashboard **49/49**, espace client **40/40**, dark-only **15/15**, logo **11/11**, **156/156** unitaires.

## [Fix-Mobile-Brief-Card] — 2026-10-19 : fin du débordement horizontal de 9 px sur /briefs en 390 px

Constat audit : sur un viewport mobile 390×844, la page `/briefs` affichait un débordement horizontal de 9 px (`scrollWidth` 399 > `clientWidth` 390). Cause : le pied de `BriefCard` — horodatage + bouton favori + bouton signaler + bouton « Démarrer la discussion · 1 Token » — tenait dans une seule ligne sans césure ; le bouton de discussion est large (~207 px) et forçait la ligne au-delà de la carte.

- **`components/brief-card.tsx`** : le conteneur du pied de carte et le slot `footer` passent en `flex flex-wrap` — sur mobile les actions descendent à la ligne sous l'horodatage au lieu de déborder ; inchangé en desktop (assez de largeur, une seule ligne).
- **`components/brief-filters.tsx`** : le `footer` fourni aux cartes (favori + signaler + déblocage) passe en `flex flex-wrap items-center gap-1` pour la même raison.
- **Vérifications exécutées** : mesure navigateur réelle 390×844 **avant/après** — `/briefs` et `/briefs?demo=1` : `scrollWidth` 399 → **390** (overflow 9 px → **0**) ; `/poster` et `/` restaient déjà à 0 (les éléments >391 px de `/` sont des décorations absolues clippées par un ancêtre `overflow-hidden`, `scrollWidth` = `clientWidth` = 390). typecheck ✓, lint ✓, **156/156 unitaires**, build ✓, e2e **58/58** (dont le test « mobile : l'ordinateur s'adapte sans débordement horizontal »).

## [Logo-Variante-Officielle] — 2026-10-19 : le lockup officiel /logo.png devient la seule variante, partout

Décision projet : « logo variante partout » — la variante retenue est le lockup officiel `/logo.png` (déjà présent en navbar et sur les pages d'authentification), appliqué désormais à **tous** les points d'ancrage de la marque. L'ancien pictogramme SVG (dessiné à la main) est retiré du composant `LogoMark`, qui n'est plus exporté.

- **`components/logo.tsx`** : suppression de `LogoMark` (SVG) ; `ImageLogoMark` et `Logo` (wrapper sr-only) restent les seules façons d'afficher le logo. `ImageLogoMark` est documenté comme variante unique.
- **Shells V8** (`components/nav/dashboard-shell.tsx`, `components/client/client-shell.tsx`) : les six emplacements (sidebar ordinateur, en-tête mobile, tiroir mobile des deux shells) passent de `<LogoMark /> + <span>TERANGA LABS</span>` à `<ImageLogoMark className="h-7 w-auto" alt="" />` — le lockup image contient déjà le nom, la redondance textuelle est retirée. Le `Link` conserve son `aria-label` d'origine (libellé inchangé pour les tests existants).
- **Footer** (`components/footer.tsx`) : le `<img src="/logo.png">` brut (avec eslint-disable no-img-element) est remplacé par `<ImageLogoMark className="h-10 w-auto" alt="" />` — même composant, même optimisation next/image que partout ailleurs.
- **Inchangé** : navbar publique (`<Logo />` → `ImageLogoMark h-8`), page d'authentification (`ImageLogoMark priority h-12`) — déjà sur la bonne variante avant la passe.
- **Vérifications exécutées** : typecheck ✓, lint ✓, **156/156 unitaires**, build ✓, script navigateur logo **11/11** (navbar publique, footer, sidebar client, sidebar dashboard, header mobile, tiroir mobile — tous en `logo.png`, plus aucun `svg[viewBox="0 0 48 48"]` dans les en-têtes), régressions espace client **40/40**, dashboard **49/49** (le script de régression du dashboard a été mis à jour pour cibler `img[src*="logo"]` au lieu de l'ancien `span` de marque), dark-only **15/15**, e2e **58/58**.

## [Dark-Only] — 2026-10-19 : thème sombre unique partout, bascule et thème clair retirés

Décision projet : « dark-only partout sans toggle ». La palette sombre de `:root` devient le seul thème du site — landing, pages publiques, dashboards V8 et espace client.

- **`app/globals.css`** : suppression du bloc `html[data-app-theme="light"]` (palette claire complète) ; les règles Display des titres `h1..h6` (Outfit, clamps, graisses) deviennent inconditionnelles — l'espace client hérite de la même typo Display que la landing et le dashboard (l'exception `html[data-app-theme]` est retirée).
- **`components/site-shell.tsx`** : plus d'état de thème, plus de synchronisation `data-app-theme` (l'attribut n'est plus jamais posé).
- **`app/layout.tsx`** : suppression du script de boot qui appliquait `tl-app-theme` avant le premier paint (fin du flash clair/sombre de l'espace app).
- **`components/client/app-routes.ts`** : `THEME_STORAGE_KEY` supprimé (plus aucun stockage de thème).
- Les composants de l'espace client étant intégralement pilotés par les variables CSS (`bg-surface`, `text-foreground`, `border-hairline`…), la bascule est purement déclarative : aucune couleur en dur à corriger (vérifié par grep).
- **Vérifications exécutées** : typecheck ✓, lint ✓, **156/156 unitaires**, build ✓, e2e **58/58**, script navigateur dark-only **15/15** (landing + `/client` + `/tokens` desktop et mobile : fond `rgb(10,10,10)`, texte `rgb(242,242,242)`, aucun attribut `data-app-theme`, aucune clé `tl-app-theme`, zéro bouton de thème, captures dans `%TEMP%\opencode\shots-dark\`), régressions espace client **40/40** et dashboard **49/49**.

## [Espace-Client-Shell-V8] — 2026-10-19 : l'espace client adopte le shell V8 (sidebar à sections + tiroir mobile), dock d'action rapide conservé

Unification de la navigation de l'espace client sur le même modèle V8 que le dashboard développeur (décision projet : « dashboard client en shell V8 »), tout en conservant le dock d'action rapide en bas (Montaaj) et le bouton Support.

- **Menu client en sections** (`components/nav/app-nav.ts`) : `CLIENT_NAV_SECTIONS` — ESPACE PRINCIPAL (Tableau de bord `/client`, Catalogue `/dev`, Mes projets `/missions`, Mes briefs `/client/briefs`), COMMUNICATION (Messages `/conversations`), MON ESPACE (Mon profil `/client/profil`, Acheter des Tokens `/tokens`, Paramètres `/parametres`) + `isClientNavLinkActive`.
- **Shell partagé** (`components/nav/shell-parts.tsx`, nouveau) : `NavSections`, `SideLink`, `ProfileBlock`, `initialsOf` extraits du dashboard-shell et réutilisés par les deux espaces (fin du dupliqué).
- **ClientShell réécrit** (`components/client/client-shell.tsx`) : sidebar fixe 256 px (plus de sidebar réductible w-16/w-52 ni persistance `tl-sidebar`), en-tête mobile sticky avec **hamburger** (tiroir coulissant V8 : overlay noir 60 %, verrouillage du scroll, fermeture à la navigation/Échap/fond), profil réel + solde de Tokens réel + déconnexion en bas de sidebar/tiroir, cloche de notifications, **dock mobile conservé** (Accueil/Projets/Messages/Catalogue + bouton central « Publier un brief »), bouton Support (FAB ordinateur + en-tête mobile). Le menu de compte (avatar + **bascule de thème**) disparaît — la bascule clair/sombre est retirée de l'espace client (la phase dark-only étend le retrait partout).
- **DashboardShell** : refactorisé sur `shell-parts` sans changement de comportement (régression navigateur 49/49 intacte : aria-labels, tiroir, verrouillage, déconnexion).
- **Correctif environnement** : BOM UTF-8 retiré de `.env.local` (les 4 tests e2e `guards.spec.ts` lisaient `.env.local` avec `startsWith` et étaient sautés depuis la réécriture Wave/Chariow du fichier).
- **Vérifications exécutées** : typecheck ✓, lint ✓, **156/156 unitaires**, build ✓, e2e **58/58** (dont guards 4/4 réactivés), script navigateur espace client **40/40** (sections/actif/profil/dock/tiroir/scroll verrouillé/Escape/zéro erreur console) + régression dashboard **49/49**.

## [Paiement-Chariow] — 2026-10-19 : Chariow remplace PayDunya ET Wave (Tokens + vérification développeur)

Remplacement complet du prestataire de paiement : **Chariow** devient l'intégration unique, en supprimant PayDunya et Wave (décision explicite du client : « Retirer Wave aussi »), pour les deux tunnels (achats de Tokens et vérification de profil développeur).

- **Nouveau client Chariow** : `lib/payments/chariow-config.ts` (env `CHARIOW_API_KEY` / `CHARIOW_PULSE_SECRET` / `CHARIOW_BASE_URL` / `CHARIOW_VERIFICATION_PRODUCT`, slugs produit = id de pack, configuration testable) et `lib/payments/chariow.ts` (création de checkout avec `payment_currency: XOF`, `custom_metadata {reference, kind, package_id}`, client IP, `parseCustomerPhone` — indicateurs dial à 3/2/1 chiffres, `splitCustomerName`, lecture `GET /v1/sales/{id}`, vérification HMAC-SHA256 `x-chariow-signature` en comparaison constante, erreurs typées `ChariowApiError`).
- **Flux sécurisé** : `POST /api/payments/checkout` et `POST /api/verification/checkout` créent l'intention + la vente Chariow ; le **Pulse** (`POST /api/payments/webhook`) vérifie la signature puis **re-vérifie côté serveur** `GET /v1/sales/{id}` (statut `completed|settled`, montant exact en XOF) avant de créditer via `credit_from_payment` / `admin_confirm_verification_payment` (idempotence) ; `GET /api/payments/webhook` = santé. Aucun crédit sur la seule parole du webhook.
- **Tunnels Tokens** : redirection vers `checkout_url`, étapes `payment` / `completed` (crédit immédiat) / `already_purchased` (409) gérées ; e-mail et **téléphone obligatoires** (400 `EMAIL_REQUIRED` / `PHONE_REQUIRED` si absents du profil).
- **Vérification développeur** : méthode `chariow` (migrée), libellé UI « Paiement en ligne », formulaire développeur reçoit `paymentsConfigured`, message d'échec `error=payment`.
- **UI/copy** : `token-card`, `/tokens`, `/verification`, hero poster et landing → « carte bancaire ou mobile money » ; section « Moyens de paiement » réécrite. (Les mentions Wave/Max It conservées portent sur les **paiements client↔développeur** P2P affichés aux clients finaux, hors checkout TERANGA.)
- **Suppressions** : `lib/payments/{paydunya,paydunya-config,wave,config,provider}.ts`, `app/api/payments/ipn/*`, 3 suites de tests dédiées ; `.env.example`, `docs/DEPLOIEMENT.md`, `README.md` mis à jour (plus de `PAYDUNYA_*` / `WAVE_*`).
- **Migrations à appliquer (SQL Editor, après 0053)** : `0054_chariow_verification_method.sql` (contrainte `method` + RPC `submit_verification_request` acceptant `chariow`, défaut `chariow`) et `0055_fix_token_transaction_types.sql` (correctif d'anomalie d'audit : les types `sponsor`, `sponsor_brief`, `pro` étaient absents de `token_transactions_type_check` — tout paiement sponsoring/PRO échouait).
- **Vérifications exécutées** : typecheck ✓, lint ✓, **156/156 tests unitaires** (dont 27 nouveaux `tests/chariow.test.ts` : signature, téléphone, noms, montants, corps de checkout, erreurs 422, lectures vente).
- **Configuration Chariow requise avant mise en prod** : boutique avec 1 produit de type **Licence** par pack (slugs `discovery|starter|pro|agence`, prix XOF identiques à `token_packages`), produit `verification-profil` (prix = `verification_price_fcfa`, défaut 5000), clé `sk_` (scopes `checkout.write` + `sales.read`), Pulse `successful.sale` signé `whsec_` vers `/api/payments/webhook`, variables `CHARIOW_*` sur Vercel. Toute divergence de prix est détectée et refusée au Pulse.

## [Dashboard-V8-Menu-Vertical] — 2026-10-19 : sidebar ordinateur + hamburger mobile sticky, navigation sectionnée façon Montaaj

Refonte du menu de navigation de l'espace dashboard d'après l'organisation/ergonomie de [montaaj.net](https://montaaj.net) (analyse de la **landing publique réellement accessible** : header fixe, nav hiérarchisée — l'espace connecté de la référence n'est pas inspectable sans compte, aucune prétention à l'avoir vu), en conservant l'identité TERANGA LABS.

- **Diagnostic du hamburger (avant refonte)** : sur toutes les pages navbar, le bouton restait mécaniquement visible au défilement (header `fixed z-50`, `elementFromPoint` = bouton à scrollY 4000+) — pas de `overflow`/`transform` parent bloquant ; en revanche **l'espace client n'avait aucun hamburger** (header sticky sans bouton menu + dock bas) et le menu existant était un simple panneau inline dans le header, pas un tiroir coulissant. Le nouveau shell garantit le comportement demandé sur les 9 routes du menu.
- **Menu centralisé** (`components/nav/app-nav.ts`, nouveau) : sections **ESPACE PRINCIPAL** (Accueil `/dashboard`, Trouver un développeur `/dev`, Agences `/agences`, Missions `/missions`, Voir les briefs `/briefs`), **COMMUNICATION** (Messages `/conversations`), **MON ESPACE** (Mon profil `/dashboard?tab=profil`, Vérifier mon profil `/verification`, Acheter des Tokens `/tokens`, Paramètres `/parametres`) — définition unique partagée par l'ordinateur et le mobile, détection d'état actif (exact / préfixe / `?tab=profil`).
- **Sidebar ordinateur** (`components/nav/dashboard-shell.tsx`, nouveau) : barre fixe `w-64` à gauche (logo `LogoMark` + « TERANGA LABS » alignés + cloche), liens par sections avec icônes cohérentes, espacement régulier, survol, page active = fond `bg-primary-soft` + tuile icône pleine + point accent + `aria-current="page"` ; **profil réel en bas** (initiales, nom depuis métadonnées puis `developers.full_name`, email auth réel), **solde de tokens réel** (`TokenBalance` ← RPC `get_token_balance`, sans valeur codée en dur) et bouton **Déconnexion** (dialogue de confirmation existant). Contenu décalé (`md:pl-64`), footer inclus : aucun chevauchement.
- **Mobile** : en-tête **sticky** (`top-0 z-40`, fond flouté) portant le hamburger toujours visible au défilement (vérifié par probe après scroll : dans le viewport, `elementFromPoint` = bouton, `position: sticky`) ; au clic, **drawer coulissant depuis la gauche** (288 px, `max-w-[85vw]`, slide d'entrée) avec **fond assombri** (overlay noir 60 %, z-45), bouton de fermeture, mêmes sections, **défilement autonome** de la liste (`overflow-y-auto overscroll-contain`), **contenu derrière immobile** (`body overflow: hidden` + vérification scrollY inchangé), fermeture à la navigation / clic sur le fond / Échap / passage en desktop ; menu fermé → contenu pleine largeur (aucun espace à gauche).
- **Branchement** (`components/site-shell.tsx`) : l'utilisateur connecté **non-client** obtient le shell sur les 9 routes du menu ; visiteur → navbar publique inchangée, rôle client → `ClientShell` intact, routes hors menu → navbar existante (aucune régression des parcours testés e2e).
- **`?tab=profil` fiable** (`components/dashboard-content.tsx`) : l'onglet est désormais aussi synchronisé **après le montage** (l'initial ne suffisait pas quand on clique « Mon profil » depuis `/dashboard` ou via retour arrière).
- **Vérifications réellement exécutées** : typecheck ✓, lint ✓, **181/181 unitaires** (`check` EXIT=0), **e2e 58/58**, script navigateur réel Playwright **49/49** (login dev réel : sidebar/coordonnées/sections/actif/offset x=256/footer, tour des 9 destinations, `?tab=profil`, mobile sticky/drawer/scroll verrouillé/overlay/fermetures/déconnexion, **zéro erreur console**), captures desktop + mobile (`%TEMP%\opencode\shots-v8\`).

## [Profil-Developpeur-Complet] — 2026-10-19 : langues, rôle projet, captures/portfolio téléversables, profil public enrichi

Combler les écarts du parcours d'inscription développeur (§ profil) tout en gardant une base **non destructive et déployable avant/après migration** : `supabase/migrations/0053_dev_languages_role_assets.sql` est prête (additive, idempotente : colonne `developers.languages`, bucket `developer-assets` + politiques propriétaire, et `CREATE OR REPLACE` des 3 RPCs `get_my_developer_application` / `submit_developer_application` / `get_public_developer_profile` enrichis).

- **Langues parlées** : champ « Langues parlées » en étape 1 du wizard (TagListInput, 10 max, schéma zod `languages`), sauvé directement sur `developers` ; **tolérance intégrée** : si la colonne n'existe pas encore (migration non appliquée), la mise à jour est retentée sans ce champ et une info claire s'affiche (« Langues non enregistrées (migration en attente)… ») — aucun blocage du parcours.
- **Rôle dans le projet** : champ « Mon rôle sur ce projet » par carte du portfolio (la colonne `developer_projects.role` existait depuis 0029 mais n'était jamais renseignée par l'inscription) ; inclus au payload `submit_developer_application` (le RPC 0025 l'écrivait déjà côté missions, pas côté candidature).
- **Captures d'écran du portfolio** : saisie par URLs (0–10, zod `screenshots` déjà présent) **+ téléversement réel** (bouton « Téléverser une image ») vers le bucket `developer-assets` (JPG/PNG/WebP, 2 Mo, chemin `{uid}/…`, extension validée serveur via politique storage) ; avatar idem sous « Photo de profil » ; **échec propre et explicite** (« Téléversement indisponible (stockage à configurer) — renseignez une URL. ») tant que la migration 0053 n'est pas appliquée — les URLs restent utilisables.
- **Profil public** : section « Langues » (chips) + « Rôle : … » sur chaque mission du portfolio.
- **Correction bloquante découverte en test réel** : `services: initial?.services ?? défaut` ne se déclenchait jamais (le RPC renvoie `[]`, pas `null`) → aucun service pré-sélectionné → zod `min(1)` **bloquait toute soumission** du wizard ; fallback corrigé (2 services proposés par défaut si la liste est vide).
- **État « dossier déposé »** : après soumission, `/inscription-developpeur` affiche le panneau « Vérification en cours » (au lieu de rouvrir le wizard) dès qu'une candidature `pending` existe (distinction par `application`, le statut `pending` étant aussi celui des profils neufs) ; `types/database.ts` enrichi (`languages` en Row/Insert et `PublicDeveloperProfile`).
- **Vérifications exécutées** : typecheck ✓, lint ✓, **181/181 tests unitaires**, **e2e 58/58** ; **tests réels backend dev** de bout en bout (funnel OTP → wizard → identité avec langues → étape 2 → téléversement (refus propre) → **soumission RPC « Inscription envoyée ! » → rechargement**) ; **login réel d'un compte existant** en local et **en prod Vercel** (`teranga-labs.vercel.app` : funnel déployé, `?next=` respecté, zéro erreur console).
- **Action requise avant activation** : appliquer `0053_dev_languages_role_assets.sql` (SQL Editor Supabase) pour activer la persistance des langues/rôle, les RPC enrichis et le téléversement.

## [Parcours-Inscription-Developpeur] — 2026-10-18 : parcours guidé « Devenir développeur » reproduit d'après la vidéo Montaaj

Le bouton « Devenir développeur » (footer, /briefs) lance désormais un vrai tunnel d'inscription en 3 temps calqué sur la démonstration de référence, **100 % branché sur l'auth Supabase existante** (aucun nouveau service, aucune migration, /signup et /login intacts, 0 régression e2e).

- **Étape 1 « Crée ton compte »** (`components/dev/register-funnel.tsx`, nouveau) : email, mot de passe + jauge de robustesse, confirmation, CGU — validations zod/messages FR, protection double soumission, pilules « Je suis développeur » (actif) / « Je suis client » (→ `/signup?role=client`), création réelle `auth.signUp` avec `role=developer` (trigger `handle_new_user` inchangé) ; compte existant → actions « Se connecter pour continuer » (avec `?next=`) + « Renvoyer un code de vérification ».
- **Étape 2 « Vérifie ton email »** : interface fidèle (6 cases auto-avance + collage, « Vérifier », « Code non reçu ? Renvoie le code » avec cooldown 60 s persistant, 5 essais limités, astuce lien valable 10 min, Retour), mécanisme sécurisé réel `signInWithOtp`/`verifyOtp` Supabase ; **la session de création (auto-confirm) est close en local** pour imposer la vérification — le wizard ne s'ouvre qu'après vérification réelle ; détection de session liens (onglet distant/focus) → finalisation auto ; reprise du parcours au rafraîchissement (`sessionStorage`), anti-requête au montage (rate-limit).
- **Étape 3** : le wizard existant `OnboardingForm` (identité → profil pro + portfolio + RPC `submit_developer_application`) prend le relais — enregistrement, validation admin et statuts conservés tels quels (pas d'étape paiement ajoutée, pas de donnée sensible demandée).
- **Routes/points d'entrée** : `/inscription-developpeur` rend le funnel pour les anonymes (au lieu du redirect /login), wizard/statuts identiques pour les connectés ; CTA `/briefs` → funnel ; `?next=` ajouté à `/login` (AuthShell/AuthCard/LoginForm, chemin interne uniquement) pour revenir au milieu du parcours.
- **Tests** : nouveau `e2e/dev-register.spec.ts` (9 tests : structure, validation FR, jauge, liens, OTP mocké Supabase via regex de routes, reprise/reload, retour, mobile 390 px sans overflow) → **58/58 e2e**, `check` complet vert (181 tests, typecheck, lint) ; **test réel backend dev** exécuté de bout en bout (compte créé → OTP envoyé → email reçu via boîte externe → lien cliqué → session → wizard, persistant au reload).

## [Refonte-Espace-Client] — 2026-10-18 : espace client reproduit d'après les captures Desktop + Mobile de montaaj.net

Refonte complète de l'espace connecté (client) conforme aux captures de référence Desktop (1376×728) et Mobile (iPhone), avec **fonctionnement réel de chaque élément** (menus, toggles, navigation, publication), fond blanc clair + accent orange Teranga, sans changement de schéma DB ni reprise de la marque Montaaj.

- **Thème clair applicatif** (`app/globals.css`, `app/layout.tsx`) : tokens `html[data-app-theme="light"]` (fond `#ffffff`), script anti-flash posé avant le premier paint sur les routes app, `suppressHydrationWarning` sur `<html>` ; typo `h1..h6` scindée : la landing publique garde son clamp Montaaj, l'app n'utilise plus que la famille Outfit (les utilitaires Tailwind `text-*` reprennent la main).
- **Shell applicatif** (`components/site-shell.tsx`, `components/client/client-shell.tsx` + `app-routes.ts`) : les routes `CLIENT_APP_ROUTES` rendent un shell dédié pour le rôle client — sidebar desktop `w-52`/`w-16` (labels complets Tableau de bord / Catalogue / Messages / Mes projets / Mes briefs / Mon profil, actif = carré plein + fond teinté, avatar bas → menu Mon profil / Paramètres / Thème / Se déconnecter), header mobile (logo, support, cloche, avatar initiales), bottom nav 5 items avec FAB + central ; logo shell = `LogoMark` + « TERANGA LABS ».
- **Dashboard** (`app/client/page.tsx`) : greeting « Heureux de te revoir, {prenom} ✨ » (mobile « Bonjour/Bonsoir » selon l'heure), carte état vide mint (icône search `rounded-2xl`, 2 pilules Publier/Catalogue), carte Tokens, cloche de notifications desktop.
- **Profil** (`app/client/profil/` + `components/client/profile-form.tsx`) : sans H1 (comme la ref), carte `max-w-3xl`, avatar solide initiales, champ nom + pilule Enregistrer inline, sauvegarde réelle via `auth.updateUser`.
- **Mes briefs** (`app/client/briefs/`) : liste des briefs du client avec états vides.
- **Paramètres** (`components/settings-content.tsx`) : H1 `text-3xl` + sous-titre gauche, cartes centrées `max-w-2xl` à petits titres icône+label, **carte E-mails** (intro « paiement, livraison, validation » + 4 toggles verts persistés en `user_metadata.email_prefs` via `auth.updateUser`, aucune migration), sécurité, suppression de compte.
- **Missions** (`components/missions/missions-dashboard.tsx`) : état vide = carte centrée seule (pas d'eyebrow/H1/chips), copy adaptée au rôle.
- **Catalogue / poster / tokens / conversations / notifications** : H1 `text-3xl` normalisés, chrome authed sur `/poster`, banner poster wrappé dans un `<span>` (fix flex cassé), grille catalogue 3 colonnes.
- **Fix hydration #418** : le déclencheur sidebar du menu compte était un `<button>` dans le `<button>` du `AccountMenu` (HTML invalide → mismatch sur toutes les pages client) → `<span>` ; variantes temps réel rendues **uniques par instance** (`notification-bell`, `notifications-page`, `message-thread`) pour éviter le doublement des topics Supabase sur le client singleton.
- **Vérifié** : dev 0 erreur / 11 pages, e2e **49/49**, `check` complet vert (181 tests, typecheck, lint, rpc), captures desktop/mobile/320-1280px/dark/menus sur build de prod, login réel Supabase.

## [Hero-Laptop-Montaaj] — 2026-10-18 : l'ordinateur du hero reproduit comme montaaj.net

Effet « grand ordinateur » du hero de [montaaj.net](https://montaaj.net) rejoué dans la home TERANGA, avec une **vraie capture du produit Teranga** dans l'écran, sans toucher au reste du site ni au backend. Marqueurs HTML/CSS extraits ligne à ligne du site de référence (scripts Playwright sur la page live, aucune vidéo disponible dans l'environnement).

- **Silhouette 3D identique** (`components/landing/hero-laptop.tsx`, nouveau) : conteneur `[perspective:800px]`, capot `perspective(800px) rotateX(-25deg)` depuis `transform-origin: center bottom` (inset `rgb(23,23,23) 0 2px 0 2px`), écran `scaleX(1.2) scaleY(0.6) rotateX(-28deg)` depuis `center top` — exactement les valeurs mesurées sur la référence.
- **Capture réelle à l'écran** : `public/hero/briefs-desktop.png` (1280×800 de `/briefs`, navbar + marketplace) en `object-cover object-left-top` sur fond `#272729` — l'écran montre le vrai produit Teranga, pas une maquette.
- **Base de clavier dessinée en pur CSS**, mot pour mot d'après l'extraction : charnière (`h-10` + barre `h-4 w-[80%] #050505`), grilles perforées latérales (`radial-gradient` 3 px), 6 rangées AZERTY ≈ 78 touches (contour `bg-white/[0.2] p-[0.5px] shadow-white`, touche `#0A090D` avec double ombre interne, libellés `text-[5px]`, `translateZ(0)` + `will-change` comme la référence), touche `option` avec glyphe ⌥ en SVG, barre espace qui prend la largeur restante, **cluster de 4 flèches** au bloc exact `mt-[2px] h-6 w-[4.9rem]` + paths SVG `M12 6l6 8H6z`, `M6 12l8-6v12z`, `M12 18l6-8H6z`, `M18 12l-8 6V6z` ; trackpad `h-32 w-[40%]` avec inset `rgba(0,0,0,.125)`, lèvre avant dégradée `h-2 w-20`.
- **Hero refondu en colonne centrée** (`components/landing/hero.tsx`) : badge 1100 ms, H1 1250 ms, sous-titre 1350 ms, CTAs 1550 ms, puis l'ordinateur `animate-rise` à 1700 ms (entrée unique et fluide, `prefers-reduced-motion` honoré par la garde de `@keyframes rise`). **Statique ensuite** : ni parallaxe ni flottement — vérifié par probe sur la référence (matrices de transform identiques avant/après mouvement de souris). Variante `Scene3D marketplace` conservée en fond atténué (`-z-10 opacity-40`) avec halo radial, voile bas identique.
- **Responsive** (demande explicite : afficher l'ordinateur aussi sur mobile, là où la référence le masque) : `scale-[0.62] / 0.78 / 0.9 / 1.0` (mobile/tablette/portrait/laptop) avec marges négatives compensatoires, largeur 32 rem figée — captures à 1440, 834 et 390 px sans aucun débordement horizontal (`scrollWidth` = largeur du viewport).
- **Nettoyage** : l'ancien visuel orbité (`hero-orbit.tsx`, supprimé via `git rm`), la carte « brief réel » (`RealBrief` + `getRealBrief` dans `app/page.tsx`), `HERO_DEMO` (`content.ts`) et les imports Supabase de la page d'accueil sont retirés — la home ne sert plus de données à l'affichage.
- **E2E** : +2 tests dans `e2e/landing.spec.ts` — présence de l'ordinateur (capture `briefs-desktop` visible + conteneur `[perspective:800px]`) et absence de débordement horizontal à 390 px — **49/49 e2e**, `tsc --noEmit` et `eslint` verts sur les fichiers touchés.

## [Auth-Montaaj] — 2026-10-17 : /login et /signup refaits à l'identique de montaaj.net

Reprise du parcours d'inscription/connexion de [montaaj.net](https://montaaj.net) (captures comparées pixel par pixel, desktop 1280×800 et mobile 390×844), en conservant **100 % du backend Teranga** (Supabase, rôles client/développeur, OTP SMS, RPC `is_phone_taken`). Aucun bouton fictif, aucun design inventé.

- **Pages nues** (`components/site-shell.tsx` + `app/layout.tsx`) : `/login` et `/signup` affichent le seul formulaire centré (`max-w-sm`), sans navbar ni footer — comme Montaaj. Colonne, logo `h-12`, h1 28 px, bascule de rôles, champs `rounded-xl bg-surface`, œil de visibilité **à gauche dans le champ**, labels `text-sm` avec astérisque rouge serré (`gap-0` sur le `Label` qui avait un `gap-2` par défaut), submit en pilule `rounded-full`, divider « ou », liens bas en `text-primary` — rythme vertical identique aux captures.
- **`components/auth-card.tsx` réécrit** : `AuthCard({ mode, initialRole })` → `LoginForm` / `SignupForm` + `Field`, `RevealButton` (wrapper `pointer-events-none`, bouton `pointer-events-auto`), `AuthAlert`, `ResetForm`. Bascule rôles en pilule `grid grid-cols-2 gap-1` avec `aria-pressed` et icônes ; ordre signup : h1, bascule, [nom, structure, région], email, mot de passe (+ aide « 8 caractères minimum, une lettre et un chiffre. » + force), confirmation, WhatsApp, [compétences], CGU, alertes, submit. Validation `noValidate` + zod FR (`mode: "onChange"`), erreurs sous les champs. Logique Supabase **inchangée** (`signInWithPassword` + redirection par `user_metadata.role`, `signUp` + `emailRedirectTo` + `is_phone_taken`, `resetPasswordForEmail`).
- **Bug de validation corrigé côté client uniquement** : `clientSignupSchema.whatsapp` rejette `""` (zod v4) → `z.preprocess` transforme la chaîne vide en `undefined` avant la regex dans `buildSignupResolver` ; `lib/validations.ts` et ses 181 tests sont intacts.
- **Bouton SMS réel** : Montaaj affiche « Continuer avec Google » — faute d'OAuth, le secondaire devient « Recevoir un code par SMS » (`components/phone-otp-form.tsx` restylé : champs `min-h-11`, submit pilule, h2 `text-xl!`). Le email reste le chemin par défaut.
- **Pages et liens** : `/login` accepte `?mode=signup` et `?role=` ; `/signup` accepte `?role=client|developer` (pré-sélectionne la bascule) et redirige les connectés vers leur espace. Liens « S'inscrire » annotés `role=developer` sur `/verification`, `/inscription-developpeur`, `/briefs` (le poster reste côté client). **`next.config.ts`** : le redirect serveur `/signup` → `/login?mode=signup` (héritage) est retiré — `GET /signup` répond 200 ; `/inscription` → `/signup` (canonical).
- **Finitions** : tailles h1/h2 en `text-[1.75rem]!` / `text-xl!` (les règles `h1`/`h2` de `globals.css` sont hors-layer et écrasaient les utilitaires Tailwind), pilule rôles responsive (`text-[13px] sm:text-sm`, `whitespace-nowrap` — « Je suis développeur » tient sur une ligne à 390 px), `PhoneInput` enrichi d'une prop `fieldClassName` (champs internes 44 px, wrapper inchangé, rétrocompatible), placeholders trompeurs retirés (seul indice conservé : `77 123 45 67` dans le champ téléphone), région pré-remplie « Dakar » (convention Teranga, comme l'onboarding développeur).
- **Inscription client : Pays puis Région** (demande de suivi) — deux sélecteurs en cascade, drapeau `flagcdn` dans le déclencheur pays (`next/image`) : on choisit d'abord le pays (9 pays du périmètre, `Sénégal` par défaut), la liste des régions se réduit alors à ce pays et changer de pays vide la région choisie. Le champ stocké reste `city` = nom de région (le pays est dérivé par `lib/geography.ts`, aucun changement backend). Nouveau e2e « Pays puis Région » (Sénégal/Dakar par défaut, bascule Mali → Bamako, plus aucune option « Dakar »).
- **E2E** : `e2e/auth.spec.ts` (14 tests) verrouille structure Montaaj, bascule rôles, cascade Pays→Région, `?role=`, `/login?mode=signup`, validation FR (WhatsApp client vide accepté, mots de passe différents), navigation croisée, absence de chrome mobile, composeur SMS + retour. Flakiness du test burger de `landing.spec.ts` corrigée (clic dans un `expect().toPass()`). **47/47 e2e ✓**, `npm run check` : RPC 154 ✓, typecheck ✓, lint 0 ✓, 181 unitaires ✓.

## [Landing-Montaaj] — 2026-10-17 : la home refaite à l'identique de montaaj.net

Reprise complète de la structure et de la finition de [montaaj.net](https://montaaj.net) (HTML + CSS analysés ligne à ligne), avec adaptation minimale : marque TERANGA, textes métier et routes d'origine ; thème sombre conservé (pas de bascule clair/sombre), polices DM Sans/Outfit conservées pour le corps.

- **Structure identique** (`app/page.tsx`) : hero `#accueil` → `#comment-ca-marche` (5 cartes en **sticky stacking** : `top: calc(6rem + n×0.75rem)`, z-index croissants, section en `rounded-t-[2.5rem]`, révélation `.is-in` par `IntersectionObserver`) → `#tarifs` (2 cartes, la seconde highlightée `border-primary/20 bg-primary-deep/20`) → `#faq` (5 `<details>` natifs avec icône `+` qui pivote en `group-open:rotate-45`) → 2 cartes rôles (checklist + CTA). Les anciennes sections (Concept, Marquee, Buyer, Sellers, Trust, Stats, Briefs récents, CTA final) sont retirées et leurs composants supprimés (`concept`, `buyer`, `sellers`, `trust`, `stats`, `cta`, `west-africa-map`, `faq-item`, `marquee-strip`).
- **Hero façon Montaaj** (`components/landing/hero.tsx` + `rotating-words.tsx`) : badge `ShieldCheck`, H1 avec **mots en rotation** en sérif italique primaire (« sans commission. / avec 1 Token. / sans intermédiaire. »), entrées échelonnées (`animate-rise`, 1100→1550 ms), halo `hero-glow` radial qui respire, voile bas vers le fond, variante mobile `min-h-[100svh]` centrée + variante desktop `grid`, CTAs en pills `rounded-full` avec `btn-shine`.
- **Design system** (`app/globals.css`) : `rounded-card` (1rem) / `rounded-control`, `font-headings` / `font-serif-display` (Bodoni Moda italic ajouté dans `app/layout.tsx` : `--font-bodoni`, Outfit enrichi du poids 900), `@keyframes rise` + `.animate-rise`, `btn-shine` (reflet qui traverse le bouton), `hero-glow`, `.stack-card`/`.is-in`, marker du résumé FAQ — tous en garde `prefers-reduced-motion`.
- **Navbar visiteur** (`components/navbar.tsx`) : liens centrés absolus (Accueil · Comment ça marche · Tarifs · FAQ), actions en pills arrondies (« Se connecter » + « Publier une demande » en `btn-shine`), menu hamburger enrichi des mêmes entrées. La branche authentifiée (dock, notifications, Tokens, déconnexion) est inchangée.
- **Footer** (`components/footer.tsx`) : marque + description, 3 colonnes (Plateforme · Compte · Aide), barre légale © TERANGA LABS Dakar, liens légaux et « Édité par Walty Group-SUARL ». La rangée de drapeaux et les réseaux sociaux sont retirés (pas de comptes sociaux TERANGA).
- **SEO** : le `FAQPage` structuré de la home reprend les 5 questions de la nouvelle FAQ.
- **E2E** (33 tests, tous verts) : 4 nouveaux tests verrouillent les 5 cartes empilées, les 5 accordéons, les 2 cartes tarifs et les 3 colonnes du footer ; test illustrations déplacé sur `/poster` (l'illustration est désormais aussi servie à l'écran visiteur) ; test header aligné sur la nouvelle nav. `npm run check` : RPC 154 ✓, typecheck ✓, lint 0 warning, 181 tests unitaires ✓.

## [Immersif-3D] — 2026-10-16 : hero orbite, carte Afrique vivante, CTA et footer enrichis

Refonte immersive de la landing **sans dépendance** (zéro WebGL/three.js, CSS 3D + SVG animé, `prefers-reduced-motion` partout, thème sombre premium conservé sur décision) :

- **Hero — orbite décorative** (`components/landing/hero-orbit.tsx`, nouveau) : mini tableau de bord (briefs ouverts, Tokens), carte de brief flottante « Boutique wax · Abidjan » avec pastille *Nouveau* qui pulse, duo client/développeur « Contact débloqué », badge « Profils vérifiés » et pièce de Token — posés en `translateZ` autour de la carte réelle, flottants (`tl-float` sur calque interne pour ne pas écraser la profondeur), avec **parallax léger au pointeur** (5° max, souris uniquement). Cachés sous `sm` (mobile = composition réduite, comme demandé pour les entrées de gamme). La carte du brief reste la seule source d'information (`aria-hidden` sur l'orbite).
- **Carte Afrique de l'Ouest vivante** (`components/landing/west-africa-map.tsx`, nouveau) : SVG inline (un `<img>` ne se stylerait pas) avec **9 villes des 9 pays** reliées par des **connexions en pointillés qui défilent** (`tl-dash-flow`) et des **halos pulsant** sur Dakar/Ouagadougou/Abidjan (`tl-pulse-ring`). Correction d'une erreur de l'ancienne illustration : **Nouakchott (Mauritanie) n'est pas dans le périmètre** — remplacée par Bissau, Conakry, Niamey, Cotonou, Lomé. Légende dynamique depuis `lib/countries.ts` (9 pays · 93 régions). `afrique-ouest.svg` mis à jour en conséquence (réserve OG).
- **CTA final** : deux scènes 3D en lisière (`team` à gauche, `marketplace` à droite, `xl+`, opacité 30 %) qui encadrent le texte sans jamais gêner les boutons.
- **Footer** : décor technologique léger (grille masquée radialement + halo orange), toujours lisible.
- **Cartes interactives** : le survol bascule désormais en léger 3D (`perspective(900px) rotateX(2.5deg))` — souris uniquement, le tactile n'a pas de hover).
- **Grille des briefs récents** : apparition au scroll (`Reveal`) comme le reste de la landing.
- **E2E** : `landing.spec.ts` passe à **10 tests** — la carte animée est verrouillée (`tl-dash-flow` réellement actif) et le test illustrations s'adapte (1 SVG externe suffit désormais sur la home).

Déjà en place (inchangé, confirmé par l'audit) : compteurs animés (`AnimatedCounter`), accordéon FAQ animé, `Reveal` au scroll sur toutes les sections, marquee 38 s, scènes 3D sur hero/agences/classement/poster/à-propos/tokens/inscription.

## [Démo-Afrique-ouest] — 2026-10-16 : les briefs de démonstration couvrent les 9 pays

- **`supabase/seed.sql` réécrit** : les 6 briefs 100 % Sénégal deviennent **10 briefs couvrant les 9 pays du périmètre** (Dakar, Ziguinchor · Abidjan · Bamako · Ouagadougou « Centre » · Lomé « Maritime » · Niamey · Conakry · Cotonou « Littoral » · Bissau), avec des commerces et budgets réalistes de la sous-région (70 000 à 250 000 FCFA). Chaque `client_city` est une **région du référentiel** (`lib/countries.ts`) : les briefs alimentent donc les compteurs `/pays/[slug]` et les filtres pays/région de leur pays. La colonne `demo` est désormais posée explicitement (badge « Exemple » + déblocage gratuit) et le préfixe WhatsApp `+2217710001xx` (détection démo, migration 0023) est conservé.
- **`supabase/seed-afrique-ouest-prod.sql`** (nouveau, à coller une fois dans le SQL Editor) : reprend les 6 briefs de démo déjà en production (UPDATE par numéro, ids conservés pour ne pas casser les déblocages existants) et ajoute les 3 pays manquants (Niamey, Conakry, Bissau) — idempotent.
- **Section « Ce qui se cherche en ce moment »** (`app/page.tsx`) : le lead ancre le marché régional (« De Dakar à Lomé, d'Abidjan à Bamako… Prix affichés en FCFA »). Le bandeau défilant listait déjà les 9 pays et leurs 93 régions.

## [Bottom-nav] — 2026-10-16 : réservée aux comptes connectés, rôles distincts, finition « vivante » façon Apple

- **Visiteurs : plus de bottom nav** (mobile comme desktop). La navigation visiteur repose sur la navbar + menu hamburger ; les scènes 3D et illustrations d'atterrissage restent inchangées.
- **Dock client ≠ dock développeur**, clairement distincts : client (Accueil · Dévs · **Publier** · Missions · Messages — l'action centrale « + » en primaire), développeur (Accueil · Briefs · Tokens · Messages · Profil — sans action centrale, le cœur du métier est la réponse aux briefs), autres rôles connectés (Briefs · Dévs · Messages · Compte).
- **Finition « vivante » façon Apple** (`components/navbar.tsx` + `app/globals.css`) : verre flottant (`backdrop-blur-2xl`, liseré lumineux haut, coins `env(safe-area-inset-bottom)` pour iPhone), **éclat qui traverse lentement le verre** (`tl-dock-sheen`, coupé en `prefers-reduced-motion`), **capsule en dégradé primaire qui glisse au ressort** (`--ease-spring`) sous l'onglet actif, icône active qui « pop » (scale 110 spring), pression tactile qui resserre l'élément (active:scale-90), entrée du dock en fondu-échelle (`tl-dock-in`). Collision de clés corrigée (`/dashboard` vs `/dashboard?tab=profil`).
- **`e2e/landing.spec.ts` mis à jour** : absence du dock vérifiée pour un visiteur (home, /briefs, /poster, desktop), hamburger mobile toujours utilisable. Les docks rôles (client/dev) exigent une session authentifiée : vérification manuelle sur compte de test.

## [Interface] — 2026-10-16 : bottom nav pour les visiteurs + animations 3D et illustrations sur les landings

- **Bottom nav (dock mobile)** visible pour **tous**, visiteurs compris — ensembles réorganisés par rôle. *(Remplacé le jour même par [Bottom-nav] : dock réservé aux comptes connectés, rôles distincts, finition Apple.)*
- **`components/landing/scene-3d.tsx`** : vraie scène 3D **sans dépendance** (perspective + translateZ, parallax au pointeur, keyframes natives `tl-float`, `prefers-reduced-motion` honoré via `globals.css`) — 5 variantes : `marketplace`, `tokens`, `brief`, `team`, `ranking`. Intégrée sur : hero de l'accueil (fond de la carte), `/agences`, `/classement`, `/poster` (écran visiteur), `/a-propos`, `/tokens`, `/inscription-developpeur` — masquée sous `lg` pour préserver les écrans d'app utiles (briefs, annuaire).
- **Illustrations de marque** dans `public/illustrations/` (6 SVG palette TERANGA) : `marketplace` → section Concept, `afrique-ouest` (carte des pays/villes desservis) → section Confiance, `brief` → `/poster` ; `tokens`, `agence`, `classement` dispo pour les usages futurs (OG, e-mails).
- **`e2e/landing.spec.ts`** (9 tests, tous verts) : bottom nav visiteur (visibilité mobile, 5 destinations, action centrale, `aria-current`, masquage desktop), présence d'une scène 3D avec perspective active sur l'accueil /classement /agences /a-propos, et chargement réel des illustrations (pas d'URL morte).

## [Disponibilité] — 2026-10-16 : écran de disponibilité dans le dashboard développeur

- **`components/availability-card.tsx`** (nouveau) : interrupteur *Disponible / Indisponible* + pastilles des jours joignables (L→D, numérotation 0049 : lundi=0 … dimanche=6), branché sur `set_my_availability` — la RPC existait depuis 0049 sans aucun écran dans le front. Lecture directe sur `developer_availability` (SELECT public, RLS) ; zéro ligne = indisponible (pas d'état « jamais configuré » à distinguer, le schéma ne le permet pas).
- Intégré à l'onglet « Mon profil & portfolio » du dashboard développeur, au-dessus de la carte de visite.
- Contrôle des noms RPC porté à **154 appels vérifiés** (123 site + 31 admin) avec le nouvel appel du front.

## [P9-fiabilisation] — 2026-10-16 : db-test lit le TAP, filet `plan(9)`, pgtap 0052

- **`scripts/db-test.mjs`** : en mode psql, un échec d'assertion pgtap (`not ok`) ne produit aucun code d'erreur SQL — le runner ne regardait que le code retour de psql et déclarait le fichier au vert, laissant la CI passer à travers d'une régression. Il lit désormais le TAP lui-même (`not ok`, plan non respecté) en plus du code retour ; logique validée sur un extrait TAP de référence.
- **`supabase/tests/rls_critique.sql`** : `plan(7)` alors que le fichier compte 9 assertions (pgtap refuse alors le verdict) → `plan(9)`.
- **`supabase/tests/phone_multi_pays.sql`** (nouveau) : 6 tests **comportementaux** sur `normalize_phone` (0052), jusque-là non testée — pas de troncature à 9 chiffres, convergence `00…`/`+…`, NULL sur numéro absent, anti-collision ivoirienne (deux `+225` distincts), colonnes générées stockées, index uniques recréés.
- **`scripts/check-rpc-names.mjs`** (nouveau, en tête de `npm run check` et de la CI qualité) : chaque `.rpc("…")` des fronts doit posséder un `CREATE FUNCTION` dans les migrations — une RPC inexistante n'échoue qu'à l'exécution (404 `PGRST202`), justement pour les 31 appels admin jamais couverts par la suite E2E. **153 appels vérifiés (122 site + 31 admin), 0 écart.**
- Reste : 0 test dans `teranga-labs-admin`, UI disponibilités (`set_my_availability` sans écran), vérification des RPC en session admin authentifiée.

## [Rattrapage-DB] — 2026-10-16 : migrations 0036→0051 appliquées sur prod + bugs runtime corrigés

La base de production (`virihuuksoepswccxsne`) ne contenait que 0035 et 0052 : les migrations 0036→0051 (vagues P1→P5) n'avaient **jamais été exécutées**, alors que le front les consomme déjà (`/classement`, `/agences`, Teranga Match, console admin). Application manuelle via le SQL Editor (bloc par bloc, sondage PostgREST après chaque bloc).

### Bugs runtime trouvés en prod (invisibles en CI : pgtap ne teste pas l'exécution, `db-test.mjs` en mode psql ignore les échecs)

| Fichier | Bug | Correction |
| --- | --- | --- |
| 0041 | CTE `scored` déclarée dans la 1re statement seulement → `relation "scored" does not exist` au 2e call (plpgsql résout les relations à l'exécution, pas à la création) | CTE re-déclarée dans la 2e statement |
| 0041 | `jsonb_agg(grp ORDER BY grp->>'key')` : `grp` est un record, pas le jsonb → `operator does not exist: record ->> unknown` | `jsonb_agg(jb ORDER BY jb->>'key')` (la colonne jsonb du sous-select) |
| 0041 | `_leaderboard_settle` : l'upsert écrivait `tokens_awarded = v_tokens`, rendant le garde `NOT EXISTS (tokens_awarded > 0)` toujours faux → **crédit des récompenses Tokens jamais effectué** | INSERT à 0, puis crédit + UPDATE |
| 0043 | `teranga_match` : même `->>` sur record (`x.score`) | `ORDER BY x.score DESC, x.reputation_score DESC` |
| 0044 | `join_agency` sans clause `RETURNS` → `42P13 function result type must be specified` | `returns jsonb` ajouté |
| 0044 | `list_agencies` : `ORDER BY a.name` hors portée de l'agregat (alias du sous-select) → `42P01 missing FROM-clause entry for table "a"` | `ORDER BY jb->>'name'` |

### Trou de privilèges bouché (0047 corrigé, retenu sur 0048→0051)

`REVOKE … FROM public` ne suffit pas : le rôle `anon` possède un grant `EXECUTE` explicite qui survit au revoke (constaté en prod). `debit_tokens` — sans garde d'identité : tout utilisateur connecté pouvait **débiter le solde d'un autre développeur** — et 16 RPC privées (agences, sponsoring, PRO) sont désormais révoquées de `public` **et** `anon` ; `log_risk_event` l'est aussi de `authenticated` (service_role uniquement). Vérifié : les 17 renvoient `401 permission denied` en appel anonyme, les lectures publiques restent en `200`.

### Portée

- **0048→0051 appliqués** : litiges + journal de risque, feature flags + disponibilités hebdomadaires, tickets support, synchronisation console admin (11 RPC admin — noms vérifiés ligne à ligne contre `teranga-labs-admin/app` et `croissance.tsx` / `support.tsx` / `risk.tsx`, console authentifiée en session `authenticated` via `lib/supabase/server.ts`).
- Revokes `+ANON` alignés sur 0048→0051 (même correction que 0047) ; référence `public.` supprimée dans l'`ON CONFLICT` de 0049 (aucun précédent du pattern qualifié).
- Sondeur final prod : **15 tables → 200**, **11 lectures anon → 200**, **10 RPC privées → 401**, **13 RPC admin → 401** ; `teranga_match` et `get_developer_score` renvoient des données réelles (résolution par UUID et par username).
- `rattrapage_0036_0051.sql` resynchronisé (16/16 sections identiques aux migrations unites, mojibake historique réparé).

Reste hors périmètre (dette P9 documentée) : pgtap comportemental sur 0052, tests admin (0 actuellement), `db-test.mjs` doit faire échouer la CI sur un pgtap en échec en mode psql, évolution de `client_country`.

## [P5-huit] — 2026-10-15 : suite E2E multi-pays (couverture des surfaces P5-ter/quater)

La suite E2E existait (10 tests) mais **ne touchait aucune des pages multi-pays** : uniquement des pages statiques et les gardes de routes. Les 6 vagues précédentes (régions, `/ville`, `/pays`, indicatifs) avaient donc été poussées sans vérification d'exécution — le seul signalement de bug (P5-sept) venait d'une erreur image remontée par hasard.

### Ajouté — `e2e/multipays.spec.ts` (10 tests)
- **`/ville`** : les 9 pays en sections, cross-vérification lib → DOM (93 entrées de région, **92 URLs uniques** après dédup « Savanes »), chaque URL du référentiel répond 200, région inconnue → 404.
- **`/ville/[region]`** : 1 échantillon par pays — le pays dérivé du slug apparaît dans la page, le `title` nomme la région (vérifie `countryCodeForRegionSlug` de bout en bout).
- **`/pays`** : 9 cartes, largeurs de drapeau dans `PUBLISHED_WIDTHS`, **zéro échec réseau d'image** après scroll.
- **`/pays/[slug]`** : les 9 pages en 200, `h1` exact, toutes les régions listées, zéro échec réseau ; slug inconnu → 404.
- **Sitemap** : 92 entrées `/ville` uniques + 9 `/pays`.
- **Indicatif (inscription)** : le `Select` propose bien les 9 pays — ancré sur l'indicatif (unique) puis le nom, car un filtre sur le nom matcherait « Guinée » dans « Guinée-Bissau ».
- **Régression P5-sept** : `getFlagUrl` ne cible que des largeurs publiées.

### Points de vigilance rencontrés (documentés pour la suite)
- **Hydratation React** : une interaction avant hydratation échoue *silencieusement* — le popup ne s'ouvre pas, sans erreur. `waitForLoadState("networkidle")` est requis avant de cliquer un `Select`.
- **`getByRole` strict** : « Guinée » matche « Guinée-Bissau » → `exact: true` obligatoire.
- **Footer** : présent sur chaque page, il rend 9 drapeaux — on asserte le **réseau**, pas un comptage d'images.
- **Ne pas lancer `test:e2e` et `check` en parallèle** : le build réécrit `.next/` pendant que `tsc` lit `.next/types/validator.ts` (faux négatif `TS6053`).

Vérifié : typecheck ✔, lint 0/0 ✔, **181 tests unitaires** ✔, **E2E 20/20** ✔.

## [P5-sept] — 2026-10-15 : drapeaux cassés (flagcdn) — bug visible uniquement à l'exécution

Ajout d'une suite E2E (Playwright, déjà en place : 10 tests) et **première exécution** : elle a révélé un bug d'affichage livré par les vagues multi-pays et invisible des tests unitaires, puisque rien ne vérifiait la résolution réseau des images.

### Le bug
`getFlagUrl(code, size)` construisait `https://flagcdn.com/w{size}/{pays}.png` pour **toute** taille. Or flagcdn ne publie que des largeurs « × 20 » — vérifié par requête réelle : **20, 40, 80, 160, 320, 640, 1280 renvoient 200 ; 16, 24, 32, 48, 64… renvoient 404**, quel que soit le pays (`sn`, `ci`, `ml`, `us`, `fr`, `de`) et quel que soit le User-Agent (navigateur ou non).

Résultat, **chaque drapeau du périmètre était en erreur** sur les pages multi-pays :

| Taille | Utilisé par | État |
| --- | --- | --- |
| 16 | `phone-input` (sélecteur d'indicatif, 9 pays) | ❌ 404 |
| 24 | `/pays/[slug]` (banderole) | ❌ 404 |
| 32 | autorisé par la signature de `getFlagUrl` | ❌ 404 |
| 48 | `/pays` (cartes) | ❌ 404 |
| 20 / 40 | `/classement` / `footer` (hardcodés) | ✅ 200 |

Second défaut : le fallback `…/xx.png` (drapeau neutre renvoyé par `Flag` **sans code pays**, utilisé par les boutons de signalement) **n'existe pas chez flagcdn → 404**.

### Corrigé — `lib/countries.ts`
- **`getFlagUrl`** arrondit la taille vers le **haut** sur une largeur réellement publiée (`FLAGCDN_WIDTHS`) : `16→20`, `24→40`, `32→40`, `48→80`. Next/Image met ensuite à l'échelle CSS demandée — aucun gain de netteté perdu, aucun 404.
- **Fallback `xx.png` → `un.png`** (la seule entrée neutre réellement servie par flagcdn).
- `country.flagUrl.replace(/\/w\d+\//, …)` : regex plutôt que substitution littérale `"/w20/"`.

`footer.tsx` (`w40`) et les `flagUrl` du référentiel (`w20/…`) étaient déjà valides : inchangés.

### Ajouté
- **`tests/flags.test.ts`** (5 tests, offline/déterministe) : verrouille le fait que `getFlagUrl` n'émet que des largeurs publiées, que l'arrondi est vers le haut, que le pays est conservé, et que le fallback n'est plus `xx.png`.
- **`e2e/`** : 10 tests (gardes de routes + pages statiques + navigation header) — exécutés en local, ils sont ce qui a attrapé le bug.

Vérifié : typecheck ✔, lint 0/0 ✔, **181 tests unitaires** ✔, **E2E 10/10** ✔ sans aucune erreur `upstream image`.

## [P5-six] — 2026-10-15 : normalisation téléphone multi-pays (migration `0052`)

Dernier point « Sénégal » du périmètre 9 pays, côté base. La migration `0024` normalisait un numéro via `right(chiffres, 9)` : correct pour le Sénégal (numéro national à 9 chiffres, l'indicatif `221` est retranché), mais **faux pour les 8 autres pays**. Ex. Côte d'Ivoire (+225, national à 10 chiffres) : deux numéros distincts `+2250708091011` et `+2251708091011` réduisaient à la même clé `808091011` — le second était rejeté à tort (« Ce numéro WhatsApp est déjà associé à un autre compte »).

### Corrigé — `supabase/migrations/0052_normalize_phone_multi_pays.sql`
- **`normalize_phone`** : conserve les chiffres internationaux complets (E.164 sans `+`, préfixe `00` retiré) au lieu de tronquer à 9. La clé est donc plus spécifique et ne peut plus créer de collision entre pays.
- **Recalcul des colonnes générées** `developers.whatsapp_key` / `client_profiles.phone_key` (DROP + ADD force Postgres à réévaluer la fonction sur chaque ligne).
- **Index uniques recréés** : sans risque d'échec — l'ancien index garantissait déjà l'unicité des 9 derniers chiffres, donc a fortiori celle de la chaîne complète.
- `check_phone_unique` (trigger) et `is_phone_taken` appellent `normalize_phone` des deux côtés : elles suivent la nouvelle définition automatiquement, aucune recréation nécessaire.

Le frontend (`normalizeWhatsApp` en `lib/tokens.ts`, corrigé en P5-bis) applique déjà la même logique (chiffres + retrait de `00`, sans forcer d'indicatif) : la clé serveur et le lien `wa.me` convergent.

> **À appliquer manuellement** dans le SQL Editor Supabase (comme les migrations précédentes) : `0052_normalize_phone_multi_pays.sql`.

Vérifié : typecheck ✔, lint 0/0 ✔, **176 tests unitaires** ✔.

## [P5-cinq] — 2026-10-14 : devise = FCFA partout (fin de la promesse GNF non tenue)

La FAQ et la page `/pays/[slug]` promettaient un affichage des prix « en GNF pour la Guinée », alors que rien n'était implémenté : le paiement (PayDunya, Wave) envoie `currency: "XOF"` et les colonnes DB sont `*_fcfa`. `lib/currency.ts` (conversions GNF↔XOF) existait mais n'était **importé nulle part**.

### Corrigé
- **FAQ landing** : « … en FCFA (en GNF pour la Guinée) » → « … en FCFA ».
- **`/pays` (index)** : footnote « Les prix sont affichés en FCFA (en GNF pour la Guinée) » → « … en FCFA ».
- **`/pays/[slug]`** : « Devise : GNF (taux configurable, non figé) » → « Les prix sont affichés en FCFA. »

### Supprimé
- `lib/currency.ts` : module de conversion GNF↔XOF jamais importé (code mort). Le support GNF (affichage ou paiement) reste ouvert comme évolution future.

Les badges « FCFA »/« GNF » sur les cartes `/pays` et `/classement` restent : ils décrivent la devise **nationale** du pays (donnée factuelle du référentiel — seule la Guinée est en GNF), pas une devise de prix.

Vérifié : typecheck ✔, lint 0/0 ✔, **176 tests unitaires** ✔.

## [P5-quater] — 2026-10-14 : textes, branding et métadonnées multi-pays

Après la correction des régions (P5-ter), les textes visibles et les métadonnées donn encore l'impression d'un site « Sénégal uniquement » alors que le périmètre est de 9 pays.

### Corrigé
- **Manifest PWA** (`public/manifest.json`) : « Marketplace inversé des développeurs du Sénégal » → « … d'Afrique de l'Ouest ».
- **À propos** : description + corps de page généralisés (exemples de villes répartis sur le bassin : Thiès, Dakar, Abidjan).
- **Mentions légales** : description metadata généralisée (l'adresse légale « Dakar, Sénégal » reste factuelle et inchangée).
- **Landing** : copyright « © TERANGA LABS — Sénégal, 2026 » → « — Afrique de l'Ouest, 2026 » ; placeholder WhatsApp d'exemple multi-pays.
- **Tokens** : PayDunya présenté comme agréé « au Sénégal et dans la sous-région ».
- **Placeholder bio développeur** (dashboard) et **placeholder pays** (agence, onboarding) : exemples non sénégalais.
- **Astuce budget** (`poster-form`) : « L'ordre de prix au Sénégal… » → « L'ordre de prix… ».
- **Assistant IA** (`brief-assistant`) : mode de livraison « (Dakar, régions, Sénégal, export) » → « (votre ville, votre pays, export) ».

### Métadonnées / SEO
- `app/layout.tsx` : `areaServed` du JSON-LD Organization **+ Guinée-Bissau** (9e pays manquant, aussi ajouté aux keywords) ; `locale`/`inLanguage` `fr_SN` → `fr`.
- `app/page.tsx` : `locale` `fr_SN` → `fr`, `inLanguage` `fr-SN` → `fr`.

### Nettoyage
- `SENEGAL_REGIONS` supprimé de `lib/tokens.ts` : plus aucun import en production depuis la généralisation P5-ter (couvert par `lib/countries.ts` / `tests/region-slugs.test.ts`). Test associé retiré de `tests/tokens.test.ts`.

Vérifié : typecheck ✔, lint 0/0 ✔, **176 tests unitaires** ✔.

## [P5-ter] — 2026-10-13 : régions multi-pays (correctif P0 — publier un brief hors Sénégal)

Le site couvre 9 pays d'Afrique de l'Ouest, mais le champ « région » était figé sur le Sénégal : les 3 schemas de validation utilisaient `z.enum(SENEGAL_REGIONS)` (14 valeurs), donc **publier un brief, s'inscrire en tant que client ou compléter son onboarding hors Sénégal rejetait la requête en HTTP 422**. Les 4 listes déroulantes n'offraient que les 14 régions sénégalaises.

### Nouveau
- `components/ui/region-select.tsx` : `RegionSelectContent` — contenu d'un `Select` listant les **92 régions** du périmètre (9 pays de `lib/countries.ts`), **groupées par pays** (en-tête `SelectLabel`). La valeur émise reste le **nom** de région (modèle de données inchangé, sans migration DB).
- `lib/countries.ts` : `ALL_REGION_NAMES` (92 noms uniques), `isKnownRegion()` (test d'appartenance insensible à la casse), `ALL_REGION_ITEMS` (map valeur→libellé pour les `Select`).
- `lib/region-slugs.ts` : généralisé aux 92 régions. Chaque slug porte désormais son `countryCode`. « Savanes » (CI + TG) est dédoublonné par slug (première occurrence conservée). `countryCodeForRegionSlug()` ajouté.
- `Kaffrine` ajouté aux régions du Sénégal dans `lib/countries.ts` (13 → 14, aligné sur `SENEGAL_REGIONS`).

### Corrigé
- `lib/validations.ts` : les 3 `z.enum(SENEGAL_REGIONS)` (`city` développeur, `client_city` brief, `city` inscription client) remplacés par un champ `regionField()` validé via `isKnownRegion()` — toute région des 9 pays est désormais acceptée.
- Les 4 sélecteurs de région (`auth-card`, `poster-form`, `dev/onboarding-form`, `dashboard-content`) branchés sur `RegionSelectContent` : liste groupée par pays au lieu des 14 régions sénégalaises.
- Pages SEO `/ville` : l'index liste les 92 régions groupées par pays (texte « Afrique de l'Ouest » au lieu de « Sénégal ») ; la page région dérive le pays affiché (badge, JSON-LD, `inLanguage: "fr"`) au lieu de durcir « Sénégal ». Le sitemap suit automatiquement (92 URLs).

### Note
Le pays n'est pas une colonne dédiée sur `requests` : il est dérivé côté app par `lib/geography.ts` (`countryCodeForPlace`). Seul « Savanes » est ambigu (existe en CI et TG) — les deux émettent « Savanes », ce qui colle au modèle par nom stocké en base.

Vérifié : typecheck ✔, lint 0/0 ✔, **177 tests unitaires** ✔.

## [P5-bis] — 2026-10-13 : champs téléphone/WhatsApp multi-pays (correctif C2)

Le site couvre 9 pays d'Afrique de l'Ouest, mais la saisie du numéro (WhatsApp/téléphone) était figée sur le Sénégal : placeholder `+221`, messages d'erreur `Ex : +221771234567`, et surtout `normalizeWhatsApp` qui **convertissait de force** tout numéro local commençant par `0` en `221…` — faux pour un Malien, Ivoirien, Béninois, etc.

### Nouveau
- `components/ui/phone-input.tsx` : champ téléphone réutilisable avec **sélecteur d'indicatif pays** (drapeau + indicatif, 9 pays de `lib/countries.ts`) et saisie de la partie nationale. Émet un numéro international complet (`+221…`, `+223…`, `+225…`…). Utilisé à l'inscription (WhatsApp), à la connexion OTP, dans l'onboarding développeur (téléphone + WhatsApp), la publication de brief (WhatsApp) et le profil dashboard.

### Corrigé
- `normalizeWhatsApp` (`lib/tokens.ts`) : ne force plus d'indicatif pays ; retire seulement les séparateurs, le `+` et le préfixe `00`. Le pays est désormais toujours explicite grâce au sélecteur.
- Messages de validation (`lib/validations.ts`) : plus d'exemple `+221771234567` — « Choisissez votre pays puis saisissez votre numéro. »
- Formulaire OTP : texte « indicatif 221 pour le Sénégal » remplacé par un libellé multi-pays.

Vérifié : typecheck ✔, lint 0/0 ✔, **175 tests unitaires** ✔.

## [P5] — 2026-10-13 : synchronisation console admin (audit R4)

Chapitre **P5** (audit `AUDIT.md` §11, périmètre console admin — dépôt séparé `teranga-labs-admin`) : les modules console livrés en P2/P4 (litiges, support, agences, croissance/sponsoring/PRO, risque) n'avaient pas de RPC de lecture côté admin. P5-1 (site) ajoute la surface SQL ; P5-2 (console) branche les modules correspondants.

### P5-1 — `0051_admin_console_sync.sql` (nouveau, non destructif)

- `admin_alerts()` étendu : `+open_disputes` (litiges ouverts) et `+open_support` (tickets support ouverts) — les 4 compteurs historiques sont inchangés.
- Nouvelles RPC admin (toutes `SECURITY DEFINER` + garde `is_admin()` + `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE authenticated`, conformément à la règle `0047`) :
  - `admin_list_disputes(p_status)` / `admin_list_support_tickets(p_status)` / `admin_list_support_messages(p_ticket_id)` / `admin_reply_support_ticket(p_ticket_id, p_body)` / `admin_close_support_ticket(p_ticket_id)`
  - `admin_list_agencies(p_status)` (compte les membres)
  - `admin_list_sponsored()` / `admin_list_subscriptions()` / `admin_list_feature_flags()` / `admin_list_risk_events(p_limit)`

**Migration à appliquer dans le SQL Editor Supabase (après `0050`).** Aucune modification du parcours public ni des garanties RLS : surface anon inchangée (les nouvelles RPC ne sont pas accordées à `anon`).

### P5-2 — console `teranga-labs-admin` (dépôt séparé)

Nouveaux modules branchés dans le shell : **Litiges** (`Scale`), **Support** (`LifeBuoy`, conversation + réponse staff + fermeture), **Agences** (`Building2`, valider/suspendre via `set_agency_status`), **Croissance & PRO** (`TrendingUp`, sponsoring actif, abonnements PRO, tarifs, feature flags avec bascule), **Événements de risque** (`ShieldAlert`). Compteurs d'alertes du shell enrichis (`open_disputes`, `open_support`).

Vérifié côté console : typecheck ✔, lint 0/0 ✔, build production ✔. Vérifié côté site (inchangé côté TS) : typecheck ✔, lint 0/0 ✔.

## [P4] — 2026-10-08 : chapitre terminé — **audit clos**

Trois vagues pour **clôturer l'audit initial** (constats C1 → C14 tous traités, suivi dans `AUDIT.md` §11).

| Vague | Contenu |
| --- | --- |
| P4-1 | Fin des tables manquantes C11 : `disputes` + `risk_events` (`0048`), `feature_flags` + `developer_availability` (`0049`), `support_tickets` (`0050`) — pgtap étendu |
| P4-2 | Page `/support` (tickets privés : ouverture, conversation, réponse, fermeture) + lien footer + garde E2E |
| P4-3 | `docs/DEPLOIEMENT.md` (§66) + `AUDIT.md` à jour (tableau de suivi C1→C14) |

**Migrations livrées : `0048_disputes_risk` → `0050_support_tickets`.** À appliquer dans l'ordre dans le SQL Editor Supabase (au-delà de `0047` déjà livrée en P3-3).

État final vérifié :
- typecheck ✔, **lint 0/0 error/warning** ✔, **174 tests unitaires** ✔, **10 tests E2E** ✔, **build Next production** ✔.
- CI complète : quality + build + db-tests (pgtap) + e2e + détection de secrets.

L'ensemble des vagues P0 → P4 est ainsi poussé : **l'audit initial est clos** — le
site couvre le parcours complet (brief → match → contact → mission → avis),
les paiements, les rôles, la sécurité SQL (RLS + privilèges verrouillés), la
qualité (typecheck, lint, 174 tests, 10 E2E, CI 5 jobs).

## [P4-3] — 2026-10-08

Troisième vague du chapitre P4 : **livrables documentaires de fin de projet** (§61, §66, suivi d'audit).

### `docs/DEPLOIEMENT.md` (nouveau)
- Guide opérationnel : prérequis, variables d'environnement (serveur vs client, service_role), procédure de migrations (non destructive, ordre, vérification pgtap), déploiement Vercel (site + console), jobs CI, contrôles post-déploiement, rappels sécurité (0047, IPN PayDunya).

### `AUDIT.md` mis à jour
- §11 ajouté : tableau de suivi C1 → C14 — **tous les constats de l'audit initial sont traités**, avec la livraison correspondante (migrations, P0-P4) et le périmètre restant hors site (console admin, dépôt séparé).

## [P4-2] — 2026-10-08

Deuxième vague du chapitre P4 : **page Support** — l'interface des tickets créés en P4-1.

### Nouveau
- **`/support`** (privée, `requireUser()`) : ouverture de ticket (sujet + message, validations côté client doublant les garde serveur), liste des tickets avec statut (`En attente`/`Répondu`/`Fermé`), conversation complète par ticket (lecture directe RLS), réponse, fermeture.
- **`components/support-tickets.tsx`** : client component suivant le pattern établi (`createClient`, `friendlyRpcError`, UI primitives du projet).
- **Footer** : lien « Support » ajouté (colonne « Découvrir ») ; page volontairement absente du plan du site (privée, `noindex`).
- **E2E** : garde `/support` → `/login` sans session.

### Vérifications
- typecheck ✔, lint 0/0 ✔, **174 tests** ✔, **10 tests E2E** ✔ (build production + `next start`).

## [P4-1] — 2026-10-08

Première vague du chapitre P4 (clôture de l'audit) : **fin des tables manquantes C11** (§45/§48/§31/§12) — 3 migrations NON destructives.

### Migration `0048_disputes_risk.sql`
- **`disputes`** : litige ouvert par un participant de la mission (client ou développeur) contre l'autre ; RLS lecture parties uniquement ; `open_dispute` (verrou mission, une seule dispute ouverte), `list_my_disputes`, `set_dispute_status` (modération `is_admin()`).
- **`risk_events`** : journal d'incidents écriture **service_role ONLY** (`log_risk_event`, même garde que `track_event`). Pas de table `risk_scores` : le score se dérive d'un `count(*)` — aucune valeur inventée (§36).

### Migration `0049_feature_flags_availability.sql`
- **`feature_flags`** : aucune seed (pas de flag inventé), lecture publique, écriture console/RPC `admin_set_feature_flag` (admin only) ; `is_feature_enabled` en défaut FALSE.
- **`developer_availability`** : 7 lignes/développeur (lun 0 → dim 6), lecture publique (annuaire), écriture `set_my_availability` (propriétaire).

### Migration `0050_support_tickets.sql`
- **`support_tickets` + `support_messages`** : support utilisateur ; RLS lecture propriétaire uniquement ; `create_support_ticket` (anti-spam : 5 tickets ouverts max), `reply_support_ticket`, `list_my_tickets`, `close_support_ticket` — réponse du support prévue via `is_staff` (console admin).

### Garde-fous pgtap
- `rls_critique.sql` : 6 nouvelles tables sous RLS (16 au total), 10 nouvelles RPC sensibles hors anon, `is_feature_enabled` ajouté aux découverte publique.
- `permissions.sql` : `is_feature_enabled(p_key text)` ajouté à la surface anon figée ; `log_risk_event` ajouté aux fonctions internes.

### Vérifications
- typecheck ✔, lint 0/0 ✔, **174 tests** inchangés ; les 3 migrations s'appliqueront sur le CI `db-tests` au prochain push.

## [P3] — 2026-10-08 : chapitre terminé

Quatre vagues livrées pour la **qualité de production** (audit C6/C7, §32).

| Vague | Contenu |
| --- | --- |
| P3-1 | Gardes de route centralisées (8 pages + 6 routes API, `CONNECTED_ROLES`, `apiRequireUser`) + test anti-régression |
| P3-2 | Abstraction `PaymentProvider` (PayDunya ⇄ Wave), checkout/vérification unifiés + tests contrat |
| P3-3 | Verrouillage RPC (revoke PUBLIC), **correctif `debit_tokens`**, tests pgtap RLS + surface anon à jour |
| P3-4 | Tests E2E Playwright (build prod + `next start`), job CI dédié |

Accompagnements transverses : la CI couvre désormais typecheck, lint, tests unitaires, build, **tests SQL pgtap** (`supabase start` applique les migrations sur base vierge) et **E2E**. `gitleaks` reste actif sur les secrets.

**Migrations livrées : `0043_score_match` → `0047_revoke_privilege_public`.** À appliquer dans l'ordre dans le SQL Editor Supabase (la `0047` est indispensable : sans elle, `debit_tokens` reste exécutable par n'importe qui).

État final vérifié :
- typecheck ✔, **lint 0/0 error/warning** ✔, **174 tests unitaires** ✔, **9 tests E2E** ✔, **build Next production** ✔ (7,4 min sur poste local, pages statiques générées sans erreur).

## [P3-4] — 2026-10-08

Quatrième vague du chapitre P3 : **tests de bout en bout (Playwright)** — smoke suite sur l'application réelle (build production + `next start`).

### Nouveau
- **`@playwright/test`** (devDependencies) + `playwright.config.ts` : serveur web isolé (`next build && next start` sur le port 3100, réutilisable hors CI), Chromium, retries sur CI, rapport HTML.
- **`e2e/smoke.spec.ts`** : les pages publiques statiques (`/plan-du-site`, `/conditions-utilisation`, `/faq`, `/a-propos`) répondent 200, la 404 fonctionne, et les liens du header (visiteur) mènent à des pages valides.
- **`e2e/guards.spec.ts`** : accueil servie, et sans session `/dashboard` comme `/client` redirigent vers `/login`. Tests à double portée : exécutés en CI (variables `NEXT_PUBLIC_SUPABASE_*` fournies), chargement de `.env.local` en local, sinon skip documenté.
- **CI** : nouveau job `e2e` (installation navigateur, exécution, upload du rapport Playwright en cas d'échec) ; `.gitignore` complété (`test-results/`, `playwright-report/`).

### Vérifications
- typecheck ✔, lint 0/0 ✔, **174 tests unitaires** inchangés, **9 tests E2E verts** en local sur build de production.

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