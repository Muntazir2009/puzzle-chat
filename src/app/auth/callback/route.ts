import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase Auth callback route.
 * Handles magic link and OAuth redirects by exchanging the
 * auth code hash in the URL for a session, then redirecting to /.
 *
 * Also ensures the user has a public.users profile row (safety net
 * in case the handle_new_user trigger failed or hasn't run yet).
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth/callback] exchangeCodeForSession error:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  /* Ensure public.users row exists (safety net for trigger failure) */
  const user = data.user;
  const userName =
    user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User";

  try {
    const { error: upsertErr } = await supabase
      .from("users")
      .upsert({ id: user.id, name: userName }, { onConflict: "id" });

    if (upsertErr) {
      console.warn(
        "[auth/callback] regular upsert failed, trying admin client:",
        upsertErr.message
      );
      /* Dynamic import to avoid loading admin client on every request */
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      await admin
        .from("users")
        .upsert({ id: user.id, name: userName }, { onConflict: "id" });
    }
  } catch (err) {
    console.error(
      "[auth/callback] profile upsert error (non-blocking):",
      err
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
