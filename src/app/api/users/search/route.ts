import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const searchSchema = z.object({
  query: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = searchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { query } = parsed.data;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    const supabase = await createClient();

    /* Search public.users by name */
    const { data: matches, error } = await supabase
      .from("users")
      .select("id, name, avatar_url")
      .neq("id", userId)
      .or(`name.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error("[users/search] error:", error);
      return NextResponse.json(
        { error: "Failed to search users" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      users: (matches ?? []).map((u) => ({
        id: u.id,
        name: u.name,
        avatar_url: u.avatar_url,
      })),
    });
  } catch (err) {
    console.error("[users/search] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
