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
 */
let _client: Pusher | null = null;

function ensureClient(): Pusher {
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
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });

  return _client;
}

/**
 * Lightweight Pusher-like facade that delegates every call to the
 * lazily-created real client.  Avoids `new Proxy(…)` to eliminate
 * TDZ ("Cannot access before initialization") errors that can
 * appear in production webpack bundles deployed to Cloudflare Workers.
 */
export const pusherClient = {
  subscribe(channel: string): Channel {
    return ensureClient().subscribe(channel);
  },
  unsubscribe(channel: string) {
    return ensureClient().unsubscribe(channel);
  },
  connect() {
    return ensureClient().connect();
  },
  disconnect() {
    return ensureClient().disconnect();
  },
} as unknown as Pusher;
