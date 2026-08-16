import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (conv.user_a !== user.id && conv.user_b !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* Update only messages NOT sent by the current user (i.e. peer's messages). */
    const { error: updateErr } = await supabase
      .from("messages")
      .update({ status: "read" })
      .eq("conversation_id", conversation_id)
      .in("id", message_ids)
      .neq("sender_id", user.id);

    if (updateErr) {
      console.error("[messages/read] update error:", updateErr);
      return NextResponse.json(
        { error: "Failed to update message status" },
        { status: 500 }
      );
    }

    /* Broadcast read receipt to the channel so the sender can update UI. */
    const otherUserId =
      conv.user_a === user.id ? conv.user_b : conv.user_a;
    const roomId = getRoomId(user.id, otherUserId);
    const channelName = getChannelName(roomId);

    const eventPayload: ChatChannelEvents["read"] = {
      message_ids,
      conversation_id,
      user_id: user.id,
    };

    await pusherServer.trigger(channelName, "read", eventPayload);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[messages/read] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
