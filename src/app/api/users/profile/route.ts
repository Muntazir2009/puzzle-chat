import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1).max(50).trim(),
});

export async function PUT(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Name must be 1-50 characters" },
        { status: 422 }
      );
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("users")
      .update({ name: parsed.data.name })
      .eq("id", authUser.id)
      .select("id, name, avatar_url")
      .single();

    if (error) {
      console.error("[users/profile] update error:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[users/profile] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
