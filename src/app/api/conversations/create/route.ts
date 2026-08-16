import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const createConvSchema = z.object({
  partner_id: z.string().uuid(),
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

    const { partner_id } = parsed.data;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    if (partner_id === userId) {
      return NextResponse.json(
        { error: "Cannot create a conversation with yourself" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const admin = createAdminClient();

    /* Ensure partner has a public.users row */
    const { data: existingPartner } = await admin
      .from("users")
      .select("id, name, avatar_url")
      .eq("id", partner_id)
      .single();

    if (!existingPartner) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    /* Create conversation via RPC */
    const { data: conversationId, error: rpcErr } = await supabase.rpc(
      "get_or_create_conversation",
      { other_user_id: partner_id },
    );

    if (rpcErr || !conversationId) {
      console.error("[conversations/create] RPC error:", rpcErr);
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversation_id: conversationId,
      partner: {
        id: existingPartner.id,
        name: existingPartner.name,
        avatar_url: existingPartner.avatar_url,
      },
    });
  } catch (err) {
    console.error("[conversations/create] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
