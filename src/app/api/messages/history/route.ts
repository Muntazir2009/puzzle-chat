import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const historyQuerySchema = z.object({
  conversation_id: z.string().uuid(),
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = historyQuerySchema.safeParse({
      conversation_id: searchParams.get("conversation_id"),
      before: searchParams.get("before") ?? undefined,
      limit: searchParams.get("limit") ?? "50",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { conversation_id, before, limit } = parsed.data;

    /* Verify auth */
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* Verify participation */
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversation_id)
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .single();

    if (convErr || !conv) {
      return NextResponse.json(
        { error: "Conversation not found or access denied" },
        { status: 404 }
      );
    }

    /* Fetch messages */
    let query = supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: messages, error: msgErr } = await query;

    if (msgErr) {
      console.error("[messages/history] query error:", msgErr);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json(messages ?? []);
  } catch (err) {
    console.error("[messages/history] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
