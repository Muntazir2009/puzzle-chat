"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Calls POST /api/users/heartbeat every 60 seconds while the component
 * is mounted.  This keeps `public.users.last_seen` up-to-date so that
 * other users can determine online/offline status.
 */
export function useHeartbeat(): void {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Fire immediately on mount
    fetch("/api/users/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});

    const id = setInterval(() => {
      if (!mountedRef.current) return;
      fetch("/api/users/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, []);
}
