import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return NextResponse.json({ error: "Missing conversation_id" }, { status: 400 });
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    const supabase = await createClient();

    /* Verify conversation participation */
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, user_a, user_b")
      .eq("id", conversation_id)
      .single();

    if (!conv) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (conv.user_a !== userId && conv.user_b !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* Mark all unread messages in this conversation as read */
    await supabase
      .from("messages")
      .update({ status: "read" })
      .eq("conversation_id", conversation_id)
      .neq("sender_id", userId)
      .neq("status", "read");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[conversations/read] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
