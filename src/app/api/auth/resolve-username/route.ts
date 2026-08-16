import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/resolve-username
 * Body: { username: string }
 * Returns: { email: string } or 404
 *
 * Looks up a user's email by their display name (username) in public.users.
 * This allows login with username instead of email.
 */
export async function POST(req: Request) {
  try {
    const { username } = await req.json();
    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, name")
      .ilike("name", username.trim())
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Now look up the email from auth.users (requires service role or the user's own session)
    // Since this is a pre-login endpoint, we'll use the admin client
    const { createClient: createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(data.id);

    if (authErr || !authUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ email: authUser.user.email });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
