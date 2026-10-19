import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { cookieOptionsWithAge } from "@/lib/supabase/cookies";

/**
 * En-tetes de securite appliques a chaque reponse HTML.
 *
 * Content-Security-Policy n'est pas pose ici volontairement : Next.js injecte
 * des scripts en ligne et une CSP statique casse l'application sans etre
 * testable en amont. Elle demanderait des nonces par requete.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  //.clickjacking : aucun site tiers ne peut afficher l'app dans un iframe
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  // un fichier ne doit jamais etre interprete dans un autre format
  response.headers.set("X-Content-Type-Options", "nosniff");
  // l'URL complete ne doit pas partir vers WhatsApp, Google, etc.
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // aucune de ces API n'est utilisee par l'app
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  // HTTPS obligatoire pendant 2 ans, sous-domaine inclus
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
  // Routes NON localisees :
  // - `/api/*` : URLs externes fixes (webhooks, callbacks) qui ne doivent
  //   pas etre reecrites vers `/fr/api/…` (inexistant → 404) ;
  // - fichiers pointes (`manifest.json`, `robots.txt`, `*.xml`…) absents de
  //   la branche `[locale]` : idem, une reecriture les casserait.
  const shouldLocalize =
    !pathname.startsWith("/api") && !pathname.includes(".");

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
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
