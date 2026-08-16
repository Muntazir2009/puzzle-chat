import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pusherServer, type ChatChannelEvents } from "@/lib/pusher-server";
import { getRoomId } from "@/lib/room";
import { getChannelName } from "@/lib/pusher-client";
import { z } from "zod";

const vanishBodySchema = z.object({
  conversation_id: z.string().uuid(),
  message_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = vanishBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { conversation_id, message_id } = parsed.data;

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

    /* Verify the message exists and is a vanish-mode message */
    const { data: msg } = await supabase
      .from("messages")
      .select("id, sender_id, vanish_mode")
      .eq("id", message_id)
      .eq("conversation_id", conversation_id)
      .single();

    if (!msg || !msg.vanish_mode) {
      return NextResponse.json(
        { error: "Message not found or not a vanish message" },
        { status: 404 }
      );
    }

    /* Delete from DB */
    const { error: deleteErr } = await supabase
      .from("messages")
      .delete()
      .eq("id", message_id);

    if (deleteErr) {
      console.error("[messages/vanish] delete error:", deleteErr);
      return NextResponse.json(
        { error: "Failed to delete message" },
        { status: 500 }
      );
    }

    /* Broadcast vanish event so all clients scrub the message. */
    const otherUserId =
      conv.user_a === user.id ? conv.user_b : conv.user_a;
    const roomId = getRoomId(user.id, otherUserId);
    const channelName = getChannelName(roomId);

    const eventPayload: ChatChannelEvents["vanish"] = {
      message_id,
      conversation_id,
    };

    await pusherServer.trigger(channelName, "vanish", eventPayload);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[messages/vanish] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
