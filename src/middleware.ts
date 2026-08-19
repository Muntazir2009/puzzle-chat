import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase Auth middleware.
 *
 * - Refreshes the session cookie on every request.
 * - Redirects unauthenticated users to /login.
 * - Redirects authenticated users away from /login to /.
 * - Lets static assets and API routes through.
 *
 * Wrapped in try/catch so edge runtime errors never return a 500.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* Static assets and API routes skip auth entirely */
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    pathname.startsWith("/robots");
  const isApiRoute = pathname.startsWith("/api/");

  if (isStaticAsset || isApiRoute) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
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
          cookiesToSet.forEach(({ name, value }) =>
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

    /* Redirect authenticated users away from /login */
    if (user && pathname.startsWith("/login")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    /* /auth/callback is public — just let the cookie refresh happen */
    if (pathname.startsWith("/auth/callback")) {
      return supabaseResponse;
    }

    /* Redirect unauthenticated users to login (but not if already on /login) */
    if (!user && !pathname.startsWith("/login")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    /* Inject user info into headers so page.tsx can read them
       without calling Supabase a second time. Only for authenticated users
       on protected routes. */
    if (user) {
      supabaseResponse.headers.set("x-user-id", user.id);
      supabaseResponse.headers.set("x-user-email", user.email ?? "");
    }

    return supabaseResponse;
  } catch (err) {
    console.error("[middleware] auth check failed:", err);
    /* Only redirect to /login for protected routes;
       /login and /auth/callback pass through on error. */
    if (pathname.startsWith("/login") || pathname.startsWith("/auth/callback")) {
      return NextResponse.next({ request });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
