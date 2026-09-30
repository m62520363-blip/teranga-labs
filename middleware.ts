import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return applySecurityHeaders(supabaseResponse);
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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              cookieOptionsWithAge(options)
            )
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  // applique apres le rafraichissement de session : setAll remplace
  // supabaseResponse, donc les en-tetes doivent partir sur l'objet final
  return applySecurityHeaders(supabaseResponse);
}

export const middleware = updateSession;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};