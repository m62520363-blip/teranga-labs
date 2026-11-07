import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { cookieOptionsWithAge } from "@/lib/supabase/cookies";

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), payment=(), interest-cohort=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://virihuuksoepswccxsne.supabase.co"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  return response;
}

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

/** Chemins publics : pas besoin de rafraîchir la session Supabase. */
const PUBLIC_FIRST_SEGMENTS = new Set([
  "", "a-propos", "faq", "cookies", "mentions-legales", "conditions-utilisation",
  "politique-de-confidentialite", "plan-du-site", "contact", "support", "pays",
  "ville", "dev", "briefs", "brief", "classement", "agences", "login", "signup",
  "orbit", "tokens", "abonnement", "verification", "poster",
]);

function isPublicPath(pathname: string): boolean {
  const stripped = pathname.replace(/^\/(en)(?=\/|$)/, "");
  const seg = stripped.split("/").filter(Boolean)[0] ?? "";
  return PUBLIC_FIRST_SEGMENTS.has(seg);
}

const handleI18nRouting = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Session Supabase uniquement sur les routes qui en ont besoin.
  const publicRoute = isPublicPath(pathname);
  const supabaseResponse = publicRoute
    ? NextResponse.next({ request })
    : await refreshSession(request);

  const shouldLocalize =
    !pathname.startsWith("/api") && !pathname.includes(".");
  if (shouldLocalize) {
    request.headers.set("x-pathname", pathname);
  }

  let response: NextResponse;
  if (shouldLocalize) {
    response = handleI18nRouting(request);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }
  } else {
    response = supabaseResponse;
  }

  applySecurityHeaders(response);

  // Cache HTTP sur les pages publiques (TTFB).
  if (publicRoute && request.method === "GET") {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    // Agentic Resource Discovery (ARD) — discovery via Link header.
    response.headers.set(
      "Link",
      '<https://devvmarket.vercel.app/.well-known/ard.json>; rel="ard"'
    );
  }

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