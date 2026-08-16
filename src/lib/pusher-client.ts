import Pusher, { type Channel, type Members } from "pusher-js";

/** Re-export the event shape so the hook can import it from one place. */
export type { ChatChannelEvents } from "./pusher-server";

/** Helper to build the private channel name for a chat room. */
export function getChannelName(roomId: string): string {
  return `private-chat-${roomId}`;
}

/** Shape of a member object returned by Pusher presence channels. */
export type ChannelMember = {
  id: string;
  info: Record<string, unknown>;
};

export type { Channel, Members };

/**
 * Lazy-initialised client-side Pusher singleton.
 *
 * Real-time subscriptions run entirely on the browser to avoid
 * Cloudflare Edge function persistent WebSocket connection timeouts.
 *
 * When `NEXT_PUBLIC_PUSHER_APP_KEY` is not set (e.g. local dev without
 * Pusher credentials) the module still exports a valid but no-op
 * client so that the UI can render and the hook can subscribe
 * without crashing.
 */
let _client: Pusher | null = null;

export function getPusherClient(): Pusher {
  if (_client) return _client;

  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "us2";

  if (!key) {
    console.warn(
      "[pusher-client] NEXT_PUBLIC_PUSHER_APP_KEY is not set. " +
        "Real-time features will be disabled."
    );
  }

  _client = new Pusher(key ?? "", {
    cluster: cluster,
    enabled: Boolean(key),
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });

  return _client;
}

/** Convenience alias kept for readability. */
export const pusherClient = new Proxy({} as Pusher, {
  get(_target, prop) {
    return (getPusherClient() as Record<string | symbol, unknown>)[prop];
  },
});
