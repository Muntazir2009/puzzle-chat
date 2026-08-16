import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pusherServer, type ChatChannelEvents } from "@/lib/pusher-server";
import { getRoomId } from "@/lib/room";
import { getChannelName } from "@/lib/pusher-client";
import { z } from "zod";

const sendBodySchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1),
  type: z.enum(["text", "image", "file"]).default("text"),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = sendBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { conversation_id, content, type } = parsed.data;

    /* Verify auth */
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* Verify the user is a participant in this conversation */
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, user_a, user_b")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (conv.user_a !== user.id && conv.user_b !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    /* Insert the message via Supabase (RLS also enforces this, but we check explicitly). */
    const { data: message, error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        sender_id: user.id,
        content,
        type,
        status: "sent",
      })
      .select()
      .single();

    if (msgErr || !message) {
      console.error("[messages/send] insert error:", msgErr);
      return NextResponse.json(
        { error: "Failed to persist message" },
        { status: 500 }
      );
    }

    /* Broadcast via Pusher */
    const otherUserId =
      conv.user_a === user.id ? conv.user_b : conv.user_a;
    const roomId = getRoomId(user.id, otherUserId);
    const channelName = getChannelName(roomId);

    const eventPayload: ChatChannelEvents["new-message"] = {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      content: message.content,
      type: message.type,
      status: message.status,
      created_at: message.created_at,
    };

    /* Trigger client events so both parties receive typing-start/stop. */
    await pusherServer.trigger(channelName, "new-message", eventPayload);

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    console.error("[messages/send] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
