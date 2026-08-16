import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/users/heartbeat
 *
 * Updates the authenticated user's `last_seen` to `now()`.
 * Called periodically (every 60s) from the client so that other
 * users can infer online status from this timestamp.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("users")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", authUser.id);

    if (error) {
      console.error("[heartbeat] update error:", error.message);
      return NextResponse.json(
        { error: "Failed to update heartbeat" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[heartbeat] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
