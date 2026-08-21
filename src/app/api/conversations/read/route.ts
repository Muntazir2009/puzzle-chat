import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { pusherServer, type ChatChannelEvents } from "@/lib/pusher-server";
import { getRoomId } from "@/lib/room";
import { getChannelName } from "@/lib/pusher-client";

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
    const { data: updatedMsgs } = await supabase
      .from("messages")
      .update({ status: "read" })
      .eq("conversation_id", conversation_id)
      .neq("sender_id", userId)
      .neq("status", "read")
      .select("id");

    /* Broadcast read receipt via Pusher so sender updates UI */
    if (updatedMsgs && updatedMsgs.length > 0) {
      const otherUserId = conv.user_a === userId ? conv.user_b : conv.user_a;
      const roomId = getRoomId(userId, otherUserId);
      const channelName = getChannelName(roomId);
      try {
        await pusherServer.trigger(channelName, "read", {
          message_ids: updatedMsgs.map(m => m.id),
          conversation_id,
          user_id: userId,
        } satisfies ChatChannelEvents["read"]);
      } catch (err) {
        console.error("[conversations/read] Pusher trigger failed (non-fatal):", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[conversations/read] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
