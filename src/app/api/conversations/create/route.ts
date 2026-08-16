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
      perPage: 1000,
    } as Parameters<typeof admin.auth.admin.listUsers>[0]);

    /* Filter by email */
    const matched = users?.filter((u) => u.email === partner_email) ?? [];
    if (listErr || matched.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const partnerUser = matched[0];
    const partnerId = partnerUser.id;

    if (partnerId === userId) {
      return NextResponse.json(
        { error: "Cannot create a conversation with yourself" },
        { status: 400 }
      );
    }

    /* Ensure partner has a public.users row — MUST use admin client
       because RLS policy users_insert_self checks auth.uid() = id,
       and auth.uid() is the current user, NOT the partner */
    await admin
      .from("users")
      .upsert(
        {
          id: partnerId,
          name: partnerUser.user_metadata?.name ?? partner_email.split("@")[0],
        },
        { onConflict: "id" },
      );

    /* Use the get_or_create_conversation RPC */
    const { data: conversationId, error: rpcErr } = await supabase.rpc(
      "get_or_create_conversation",
      { other_user_id: partnerId },
    );

    if (rpcErr || !conversationId) {
      console.error("[conversations/create] RPC error:", rpcErr);
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    /* Fetch partner profile from public users table */
    const { data: partnerProfile } = await supabase
      .from("users")
      .select("id, name, avatar_url")
      .eq("id", partnerId)
      .single();

    return NextResponse.json({
      conversation_id: conversationId,
      partner: partnerProfile
        ? { id: partnerProfile.id, name: partnerProfile.name, avatar_url: partnerProfile.avatar_url }
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
