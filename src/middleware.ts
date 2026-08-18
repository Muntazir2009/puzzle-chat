import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase Auth middleware.
 *
 * - Refreshes the session cookie on every request.
 * - Redirects unauthenticated users to /login.
 * - Redirects authenticated users away from /login to /.
 * - Lets public assets and API auth routes through.
 *
 * Wrapped in try/catch so a misconfigured Supabase or a network
 * blip on the edge worker never returns a 500 to the client.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* Public paths that don't need auth */
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    pathname.startsWith("/robots");

  /* API auth routes (Pusher auth, etc.) are validated inside the handler */
  const isApiRoute = pathname.startsWith("/api/");

  /* Fast path: public assets skip Supabase entirely */
  if (isPublicPath || isApiRoute) {
    return NextResponse.next({ request });
  }

  /* Only talk to Supabase when we actually need auth info */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    /* No credentials configured — let the request through and let
       the page/API handle the missing-config case itself. */
    return NextResponse.next({ request });
  }

  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    /* Redirect unauthenticated users to login */
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    /* Inject user info into headers so server components can read it
       without an extra Supabase call. */
    supabaseResponse.headers.set("x-user-id", user.id);
    supabaseResponse.headers.set("x-user-email", user.email ?? "");

    return supabaseResponse;
  } catch (err) {
    /* Any error in Supabase auth (network, invalid token, etc.)
       — redirect to login rather than returning a 500. */
    console.error("[middleware] auth check failed:", err);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - public assets (favicon.ico, robots.txt, etc.)
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
