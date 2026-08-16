import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

/**
 * Pusher private-channel authorisation endpoint.
 * The client SDK calls this automatically before subscribing.
 * We verify the user session (Supabase or demo header) so that
 * unauthenticated browsers cannot join any private chat channel.
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channelName = searchParams.get("channel_name");
    const socketId = searchParams.get("socket_id");

    if (!channelName || !socketId) {
      return NextResponse.json(
        { error: "Missing channel_name or socket_id" },
        { status: 400 }
      );
    }

    const authUser = await getAuthUser(req);

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = authUser.id;

    /*
     * Allow two channel patterns:
     *  1. private-chat-{roomId}  — standard private chat channel
     *  2. presence-{roomId}      — Pusher presence channel for online status
     * Both use the same deterministic room ID (sorted user IDs joined by _).
     */
    const chatMatch = channelName.match(/^private-chat-(.+)$/);
    const presenceMatch = channelName.match(/^presence-(.+)$/);
    const match = chatMatch ?? presenceMatch;
    const isPresence = Boolean(presenceMatch);

    if (!match) {
      return NextResponse.json(
        { error: "Invalid channel name" },
        { status: 403 }
      );
    }

    const roomId = match[1];
    const userIds = roomId.split("_");

    if (userIds.length !== 2 || !userIds.includes(userId)) {
      return NextResponse.json(
        { error: "You are not a participant in this conversation" },
        { status: 403 }
      );
    }

    /* Delegate signing to the Pusher HTTP API. */
    const pusherAppId = process.env.PUSHER_APP_ID;
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
    const pusherSecret = process.env.PUSHER_SECRET;

    if (!pusherAppId || !pusherKey || !pusherSecret) {
      return NextResponse.json(
        { error: "Pusher server config is missing" },
        { status: 500 }
      );
    }

    const crypto = await import("node:crypto");

    /*
     * For presence channels the channel_data is part of the string
     * that gets signed, so we must build it before computing the HMAC.
     */
    const channelData = JSON.stringify({ user_id: userId });

    const stringToSign = isPresence
      ? `${socketId}:${channelName}:${channelData}`
      : `${socketId}:${channelName}`;

    const signature = crypto
      .createHmac("sha256", pusherSecret)
      .update(stringToSign)
      .digest("hex");

    /*
     * For private channels we still echo channel_data so the client
     * can inspect who authorised (used by the presence subscription
     * success callback).  For non-presence channels it's harmless.
     */
    const auth = JSON.stringify({
      auth: `${pusherKey}:${signature}`,
      channel_data: channelData,
    });

    return new NextResponse(auth, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[pusher/auth] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
