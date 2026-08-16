import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const deleteSchema = z.object({
  conversation_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = deleteSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid conversation_id" },
        { status: 422 }
      );
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    /* Verify the user is part of this conversation */
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", parsed.data.conversation_id)
      .or(`user_a.eq.${authUser.id},user_b.eq.${authUser.id}`)
      .single();

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    /* Delete all messages first (cascade should handle this, but be explicit) */
    await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", parsed.data.conversation_id);

    /* Delete the conversation */
    await supabase
      .from("conversations")
      .delete()
      .eq("id", parsed.data.conversation_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[conversations/delete] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
