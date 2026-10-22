import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { cookieOptionsWithAge } from "@/lib/supabase/cookies";

/**
 * En-tetes de securite appliques a chaque reponse HTML.
 *
 * C'EST LE SEUL ENDROIT MAITRE pour les headers relatifs au contenu
 * (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
 * Permissions-Policy). `next.config.ts` ne garde que le HSTS, qui doit
 * aussi s'appliquer aux assets statiques exclus du matcher du middleware.
 *
 * Le middleware s'aplique en DERNIER (voir `middleware()` plus bas) : toute
 * valeur posee ici ecrase celle de `next.config.ts`, d'ou l'unicite visee.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  // Clickjacking : aucun site tiers ne peut afficher l'app dans un iframe.
  response.headers.set("X-Frame-Options", "DENY");
  // Un fichier ne doit jamais etre interprete dans un autre format.
  response.headers.set("X-Content-Type-Options", "nosniff");
  // L'URL complete ne doit pas partir vers WhatsApp, Google, etc.
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Aucune de ces API n'est utilisee par l'app.
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), payment=(), interest-cohort=()"
  );
  // CSP : directives structurelles + cadrage des formulaires.
  // `form-action` inclut le domaine Supabase (formulaire de contact qui
  // pointe vers une fonction edge / storage). `frame-ancestors` suffit au
  // clickjacking (pas besoin de `default-src` ici : Next injecte des
  // scripts en ligne, une CSP complete casserait l'app sans nonces).
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://virihuuksoepswccxsne.supabase.co"
  );
  // HTTPS obligatoire pendant 2 ans, sous-domaine inclus.
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  return response;
}

/**
 * Rafraichit la session Supabase (tokens d'acces expires).
 *
 * Effets recherches, dans cet ordre :
 * 1. `request.cookies.set(...)` mute `request.headers` en place — les
 *    en-tetes frais seront donc captures par le middleware next-intl, qui
 *    les propage au rendu des server components (evite un double rafraichissement
 *    du refresh token a usage unique).
 * 2. La reponse retournee porte les `Set-Cookie` a renvoyer au navigateur.
 */
async function refreshSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, cookieOptionsWithAge(options))
          );
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

/** Routage i18n next-intl (FR sans préfixe, `/en` pour l'anglais). */
const handleI18nRouting = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. Session Supabase EN PREMIER : mute `request.cookies` (donc
  //    `request.headers`) avant que next-intl ne copie les en-tetes frais
  //    dans sa reponse de reecriture.
  const supabaseResponse = await refreshSession(request);

  const pathname = request.nextUrl.pathname;
  // Transmet le chemin public aux server components via `headers()`
  // (`x-pathname`), pour construire canonical + hreflang dans la metadata
  // racine. C'est un en-tete de REQUETE : Next le propage au rendu.
  const shouldLocalize =
    !pathname.startsWith("/api") && !pathname.includes(".");
  if (shouldLocalize) {
    request.headers.set("x-pathname", pathname);
  }

  let response: NextResponse;
  if (shouldLocalize) {
    response = handleI18nRouting(request);
    // 2. Conserve les cookies d'auth fraichis sur la reponse intl
    //    (reecriture / redirection), au lieu d'une `NextResponse.next()`
    //    fraiche qui ecraserait la reecriture du routage i18n.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }
  } else {
    response = supabaseResponse;
  }

  // 3. En-tetes de securite en DERNIER, sur la reponse finale.
  applySecurityHeaders(response);

  // 4. Transmet le chemin public a la metadata (canonical + hreflang).
  //    Le root layout ne peut pas connaitre le pathname autrement, et
  //    `headers()` y est deja appele (la page est dynamique via les cookies).
  if (shouldLocalize) {
    response.headers.set("x-pathname", pathname);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
