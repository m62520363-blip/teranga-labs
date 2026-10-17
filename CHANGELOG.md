# Changelog

Toutes les modifications notables du projet TERANGA LABS sont documentées ici (§61 du cahier des charges). Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

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