import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const createConvSchema = z.object({
  partner_email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = createConvSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { partner_email } = parsed.data;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    const supabase = await createClient();

    /* Look up partner by email using admin auth API */
    const admin = createAdminClient();
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      filters: { email: partner_email },
    });

    if (listErr || !users || users.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const partnerId = users[0].id;

    if (partnerId === userId) {
      return NextResponse.json(
        { error: "Cannot create a conversation with yourself" },
        { status: 400 }
      );
    }

    /* Ensure partner has a public.users row */
    await supabase.from("users").upsert(
      {
        id: partnerId,
        name: users[0].user_metadata?.name ?? partner_email.split("@")[0],
      },
      { onConflict: "id" },
    ).ignore();

    /* Use the get_or_create_conversation RPC */
    const { data: conversationId, error: rpcErr } = await supabase.rpc(
      "get_or_create_conversation",
      { other_user_id: partnerId }
    );

    if (rpcErr || !conversationId) {
      console.error("[conversations/create] RPC error:", rpcErr);
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    /* Fetch partner profile from public users table */
    const { data: partner } = await supabase
      .from("users")
      .select("id, name, avatar_url")
      .eq("id", partnerId)
      .single();

    return NextResponse.json({
      conversation_id: conversationId,
      partner: partner
        ? { id: partner.id, name: partner.name, avatar_url: partner.avatar_url }
        : { id: partnerId, name: "Unknown", avatar_url: null },
    });
  } catch (err) {
    console.error("[conversations/create] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
