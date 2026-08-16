import Pusher from "pusher";

/** Typed event map for the chat channel. */
export interface ChatChannelEvents {
  "new-message": {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    type: "text" | "image" | "file";
    status: "sending" | "sent" | "delivered" | "read" | "failed";
    vanish_mode: boolean;
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
  "typing-start": {
    user_id: string;
  };
  "typing-stop": {
    user_id: string;
  };
  "vanish": {
    message_id: string;
    conversation_id: string;
  };
}

/**
 * Server-side Pusher instance (lazy-initialised).
 *
 * Used exclusively in API routes / server actions to broadcast events.
 * The client-side never touches this module.
 *
 * Throws at call-site (not import time) when credentials are missing
 * so that the module tree can be statically analysed without crashing.
 */
let _server: Pusher | null = null;

export function getPusherServer(): Pusher {
  if (_server) return _server;

  const app_id = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "us2";
  const useTLS = process.env.PUSHER_USE_TLS !== "false";

  if (!app_id || !key || !secret) {
    throw new Error(
      "Pusher server credentials are incomplete. " +
        "Set PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_KEY, and PUSHER_SECRET."
    );
  }

  _server = new Pusher({
    appId: app_id,
    key: key,
    secret: secret,
    cluster: cluster,
    useTLS: useTLS,
  });

  return _server;
}

/** Convenience alias. */
export const pusherServer = new Proxy({} as Pusher, {
  get(_target, prop) {
    return (getPusherServer() as Record<string | symbol, unknown>)[prop];
  },
});
