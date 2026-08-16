import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { pusherServer, type ChatChannelEvents } from "@/lib/pusher-server";
import { getRoomId } from "@/lib/room";
import { getChannelName } from "@/lib/pusher-client";
import { z } from "zod";

const reactionBodySchema = z.object({
  conversation_id: z.string().uuid(),
  message_id: z.string().uuid(),
  emoji: z.string().max(8),
  add: z.boolean(),
});

const VALID_EMOJIS = new Set(["👍", "❤️", "😂", "😮", "😢", "😡", "🙏"]);

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = reactionBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
    }
    const { conversation_id, message_id, emoji, add } = parsed.data;

    if (!VALID_EMOJIS.has(emoji)) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 422 });
    }

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

    const { data: msg } = await supabase
      .from("messages").select("reactions").eq("id", message_id).single();
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    let reactions: Record<string, string[]> = (msg.reactions as Record<string, string[]>) || {};
    if (add) {
      const arr = reactions[emoji] || [];
      if (!arr.includes(userId)) reactions[emoji] = [...arr, userId];
    } else {
      const arr = reactions[emoji] || [];
      const filtered = arr.filter((id) => id !== userId);
      if (filtered.length === 0) delete reactions[emoji];
      else reactions[emoji] = filtered;
    }

    const { error } = await supabase
      .from("messages").update({ reactions }).eq("id", message_id);
    if (error) {
      console.error("[messages/reaction] update error:", error);
      return NextResponse.json({ error: "Failed to update reaction" }, { status: 500 });
    }

    const otherUserId = conv.user_a === userId ? conv.user_b : conv.user_a;
    const roomId = getRoomId(userId, otherUserId);
    const channelName = getChannelName(roomId);

    const eventPayload: ChatChannelEvents["reaction"] = {
      message_id,
      conversation_id,
      user_id: userId,
      emoji,
      add,
    };
    await pusherServer.trigger(channelName, "reaction", eventPayload);

    return NextResponse.json({ ok: true, reactions }, { status: 200 });
  } catch (err) {
    console.error("[messages/reaction] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
