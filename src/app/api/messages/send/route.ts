import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { pusherServer, type ChatChannelEvents } from "@/lib/pusher-server";
import { getRoomId } from "@/lib/room";
import { getChannelName } from "@/lib/pusher-client";
import { z } from "zod";

const sendBodySchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1),
  type: z.enum(["text", "image", "file", "voice"]).default("text"),
  vanish_mode: z.boolean().default(false),
  ephemeral_seconds: z.number().int().positive().nullable().default(null),
  reply_to_id: z.string().uuid().nullable().default(null),
  voice_duration: z.number().int().nonnegative().nullable().default(null),
  waveform_data: z.array(z.number()).nullable().default(null),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = sendBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const { conversation_id, content, type, vanish_mode, ephemeral_seconds, reply_to_id, voice_duration, waveform_data } = parsed.data;

    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authUser.id;

    const supabase = await createClient();

    const { data: conv } = await supabase
      .from("conversations").select("id, user_a, user_b").eq("id", conversation_id).single();
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    if (conv.user_a !== userId && conv.user_b !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* Resolve reply-to context */
    let reply_to_content: string | null = null;
    let reply_to_sender_name: string | null = null;
    if (reply_to_id) {
      const { data: replyMsg } = await supabase
        .from("messages").select("content, sender_id").eq("id", reply_to_id).single();
      if (replyMsg) {
        reply_to_content = replyMsg.content;
        const { data: replyUser } = await supabase
          .from("users").select("name").eq("id", replyMsg.sender_id).single();
        reply_to_sender_name = replyUser?.name ?? null;
      }
    }

    /* Resolve sender name */
    const { data: senderProfile } = await supabase
      .from("users").select("name").eq("id", userId).single();
    const sender_name = senderProfile?.name ?? "Unknown";

    const { data: message, error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        sender_id: userId,
        reply_to_id: reply_to_id ?? null,
        content,
        type,
        vanish_mode,
        ephemeral_seconds: ephemeral_seconds ?? null,
        voice_duration: voice_duration ?? null,
        waveform_data: waveform_data ?? null,
        status: "sent",
      })
      .select()
      .single();

    if (msgErr || !message) {
      console.error("[messages/send] insert error:", msgErr);
      return NextResponse.json({ error: "Failed to persist message" }, { status: 500 });
    }

    /*
     * Fire Pusher event in a non-blocking try/catch so that a Pusher
     * failure (e.g. on Cloudflare Workers where the `pusher` Node SDK may
     * not work correctly) does NOT cause a 500 response when the message
     * was already persisted to the database.
     */
    try {
      const otherUserId = conv.user_a === userId ? conv.user_b : conv.user_a;
      const roomId = getRoomId(userId, otherUserId);
      const channelName = getChannelName(roomId);

      const eventPayload: ChatChannelEvents["new-message"] = {
        id: message.id,
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        sender_name,
        reply_to_id: message.reply_to_id,
        reply_to_content,
        reply_to_sender_name,
        content: message.content,
        type: message.type,
        status: message.status,
        vanish_mode: message.vanish_mode,
        ephemeral_seconds: message.ephemeral_seconds,
        voice_duration: message.voice_duration,
        waveform_data: message.waveform_data as number[] | null,
        reactions: (message.reactions as Record<string, string[]>) || {},
        created_at: message.created_at,
      };

      await pusherServer.trigger(channelName, "new-message", eventPayload);
    } catch (pusherErr) {
      /* Log but don't fail — message is already in the DB */
      console.error("[messages/send] Pusher trigger failed (non-fatal):", pusherErr);
    }

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    console.error("[messages/send] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
