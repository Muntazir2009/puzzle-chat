import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { pusherServer, type ChatChannelEvents } from "@/lib/pusher-server";
import { getRoomId } from "@/lib/room";
import { getChannelName } from "@/lib/pusher-client";
import { z } from "zod";

const readBodySchema = z.object({
  conversation_id: z.string().uuid(),
  /** IDs of messages to mark as read (must belong to the OTHER user). */
  message_ids: z.array(z.string().uuid()).min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = readBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { conversation_id, message_ids } = parsed.data;

    /* Verify auth */
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
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (conv.user_a !== userId && conv.user_b !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* Update only messages NOT sent by the current user (i.e. peer's messages). */
    const { error: updateErr } = await supabase
      .from("messages")
      .update({ status: "read" })
      .eq("conversation_id", conversation_id)
      .in("id", message_ids)
      .neq("sender_id", userId);

    if (updateErr) {
      console.error("[messages/read] update error:", updateErr);
      return NextResponse.json(
        { error: "Failed to update message status" },
        { status: 500 }
      );
    }

    /* Broadcast read receipt to the channel so the sender can update UI. */
    const otherUserId =
      conv.user_a === userId ? conv.user_b : conv.user_a;
    const roomId = getRoomId(userId, otherUserId);
    const channelName = getChannelName(roomId);

    const eventPayload: ChatChannelEvents["read"] = {
      message_ids,
      conversation_id,
      user_id: userId,
    };

    try {
      await pusherServer.trigger(channelName, "read", eventPayload);
    } catch (err) {
      console.error("[messages/read] Pusher trigger failed (non-fatal):", err);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[messages/read] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
