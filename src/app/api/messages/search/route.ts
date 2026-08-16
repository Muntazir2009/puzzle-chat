import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const searchQuerySchema = z.object({
  conversation_id: z.string().uuid(),
  q: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = searchQuerySchema.safeParse({
      conversation_id: searchParams.get("conversation_id"),
      q: searchParams.get("q") ?? "",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { conversation_id, q } = parsed.data;

    /* Verify auth */
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    const supabase = await createClient();

    /* Verify participation */
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversation_id)
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .single();

    if (convErr || !conv) {
      return NextResponse.json(
        { error: "Conversation not found or access denied" },
        { status: 404 }
      );
    }

    /* Search messages with ILIKE */
    const { data: messages, error: msgErr } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation_id)
      .ilike("content", `%${q}%`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (msgErr) {
      console.error("[messages/search] query error:", msgErr);
      return NextResponse.json(
        { error: "Failed to search messages" },
        { status: 500 }
      );
    }

    return NextResponse.json(messages ?? []);
  } catch (err) {
    console.error("[messages/search] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
