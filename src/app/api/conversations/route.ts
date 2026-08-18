import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    const supabase = await createClient();

    /* 1. Fetch conversations for this user, ordered by updated_at DESC */
    const { data: conversations, error: convErr } = await supabase
      .from("conversations")
      .select("id, user_a, user_b, updated_at")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("updated_at", { ascending: false });

    if (convErr) {
      console.error("[conversations] query error:", convErr);
      return NextResponse.json(
        { error: "Failed to fetch conversations" },
        { status: 500 }
      );
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json([]);
    }

    /* 2. Collect partner IDs */
    const partnerIds = conversations.map((c) =>
      c.user_a === userId ? c.user_b : c.user_a
    );
    const uniquePartnerIds = [...new Set(partnerIds)];
    const conversationIds = conversations.map((c) => c.id);

    /* 3. Fetch partner user info in one query */
    const { data: partners } = await supabase
      .from("users")
      .select("id, name, avatar_url")
      .in("id", uniquePartnerIds);

    const partnerMap = new Map(
      (partners ?? []).map((u) => [u.id, u])
    );

    /* 4. Fetch last messages per conversation — single query using distinct on */
    const { data: lastMessages } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at, sender_id")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    /* Pick the most recent message per conversation from the sorted list */
    const lastMessageMap = new Map<string, (typeof lastMessages)[number]>();
    for (const msg of lastMessages ?? []) {
      if (!lastMessageMap.has(msg.conversation_id)) {
        lastMessageMap.set(msg.conversation_id, msg);
      }
    }

    /* 5. Fetch unread message counts per conversation */
    const { data: unreadMessages } = await supabase
      .from("messages")
      .select("conversation_id, sender_id, status")
      .in("conversation_id", conversationIds)
      .neq("sender_id", userId)
      .neq("status", "read");

    const unreadCountMap = new Map<string, number>();
    for (const msg of unreadMessages ?? []) {
      const count = unreadCountMap.get(msg.conversation_id) ?? 0;
      unreadCountMap.set(msg.conversation_id, count + 1);
    }

    /* 6. Assemble response */
    const result = conversations.map((c) => {
      const partnerId = c.user_a === userId ? c.user_b : c.user_a;
      const partner = partnerMap.get(partnerId);
      const lastMsg = lastMessageMap.get(c.id);

      return {
        id: c.id,
        partner: partner
          ? {
              id: partner.id,
              name: partner.name,
              avatar_url: partner.avatar_url,
            }
          : { id: partnerId, name: "Unknown", avatar_url: null },
        last_message: lastMsg
          ? {
              content: lastMsg.content,
              created_at: lastMsg.created_at,
              sender_id: lastMsg.sender_id,
            }
          : null,
        unread_count: unreadCountMap.get(c.id) ?? 0,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[conversations] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
