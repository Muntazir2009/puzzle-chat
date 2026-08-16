import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

type UserStatus = {
  online: boolean;
  last_seen: string;
};

export type BatchStatusResponse = Record<string, UserStatus>;

/**
 * POST /api/users/batch-status
 *
 * Body: { user_ids: string[] }
 * Returns: { [userId]: { online: boolean, last_seen: string } }
 *
 * Same as /api/users/status but explicitly named for the
 * conversation-list use-case where we need statuses for many
 * partner users at once.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { user_ids?: string[] } = await req.json();
    const userIds = body.user_ids;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "user_ids must be a non-empty array" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, last_seen")
      .in("id", userIds);

    if (error) {
      console.error("[batch-status] query error:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch user statuses" },
        { status: 500 },
      );
    }

    const now = Date.now();
    const result: BatchStatusResponse = {};

    for (const user of data ?? []) {
      const lastSeen = user.last_seen ? new Date(user.last_seen).getTime() : 0;
      result[user.id] = {
        online: now - lastSeen < ONLINE_THRESHOLD_MS,
        last_seen: user.last_seen,
      };
    }

    // Fill in missing users with offline status
    for (const uid of userIds) {
      if (!result[uid]) {
        result[uid] = { online: false, last_seen: "" };
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[batch-status] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
