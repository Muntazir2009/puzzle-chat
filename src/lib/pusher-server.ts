import Pusher from "pusher";

/** Typed event map for the chat channel. */
export interface ChatChannelEvents {
  "new-message": {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_name: string;
    reply_to_id: string | null;
    reply_to_content: string | null;
    reply_to_sender_name: string | null;
    content: string;
    type: "text" | "image" | "file" | "voice";
    status: "sending" | "sent" | "delivered" | "read" | "failed";
    vanish_mode: boolean;
    ephemeral_seconds: number | null;
    voice_duration: number | null;
    waveform_data: number[] | null;
    reactions: Record<string, string[]>;
    created_at: string;
  };
  "delivered": {
    message_id: string;
    conversation_id: string;
    user_id: string;
  };
  "read": {
    message_ids: string[];
    conversation_id: string;
    user_id: string;
  };
  "typing-start": { user_id: string };
  "typing-stop": { user_id: string };
  "vanish": { message_id: string; conversation_id: string };
  "reaction": {
    message_id: string;
    conversation_id: string;
    user_id: string;
    emoji: string;
    add: boolean;
  };
}

let _server: Pusher | null = null;

export function getPusherServer(): Pusher {
  if (_server) return _server;
  const app_id = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "us2";
  const useTLS = process.env.PUSHER_USE_TLS !== "false";
  if (!app_id || !key || !secret) {
    throw new Error("Pusher server credentials are incomplete.");
  }
  _server = new Pusher({ appId: app_id, key, secret, cluster, useTLS });
  return _server;
}

export const pusherServer = new Proxy({} as Pusher, {
  get(_target, prop) {
    return (getPusherServer() as Record<string | symbol, unknown>)[prop];
  },
});
