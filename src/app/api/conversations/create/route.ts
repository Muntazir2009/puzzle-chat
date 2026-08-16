import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    /* Look up partner by email in auth.users — use admin client */
    // The public `users` table doesn't store email, so we need to look up
    // the auth.users table via an RPC or admin query.
    // We use the admin client to query auth.users for the email.
    // But since the Database types don't include auth.users, we cast.
    //
    // Alternative: search the public users table by name (won't match email).
    // The practical approach is to use the admin client.

    // Dynamic import to avoid pulling admin client on every request path
    const { createAdminClient } = await import(
      "@/lib/supabase/admin"
    );
    const admin = createAdminClient();

    // Query auth.users by email — bypass TypeScript by using any cast
    const { data: authUsers, error: authErr } = await (admin as any)
      .from("users")
      .select("id")
      .eq("email", partner_email)
      .limit(1)
      .single();

    if (authErr || !authUsers) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const partnerId = authUsers.id as string;

    if (partnerId === userId) {
      return NextResponse.json(
        { error: "Cannot create a conversation with yourself" },
        { status: 400 }
      );
    }

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
