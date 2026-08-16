import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Pusher private-channel authorisation endpoint.
 * The client SDK calls this automatically before subscribing.
 * We verify the Supabase session so that unauthenticated browsers
 * cannot join any private chat channel.
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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    /* Only allow subscribing to private-chat- channels the user belongs to. */
    const match = channelName.match(/^private-chat-(.+)$/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid channel name" },
        { status: 403 }
      );
    }

    const roomId = match[1];
    const userIds = roomId.split("_");

    if (userIds.length !== 2 || !userIds.includes(user.id)) {
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

    const stringToSign = `${socketId}:${channelName}`;
    const signature = crypto
      .createHmac("sha256", pusherSecret)
      .update(stringToSign)
      .digest("hex");

    const auth = JSON.stringify({
      auth: `${pusherKey}:${signature}`,
      channel_data: JSON.stringify({ user_id: user.id }),
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
