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
    const { data: nameMatches, error: nameErr } = await supabase
      .from("users")
      .select("id, name, avatar_url")
      .neq("id", userId)
      .ilike("name", `%${query}%`)
      .limit(10);

    if (nameErr) {
      console.error("[users/search] name query error:", nameErr);
      return NextResponse.json(
        { error: "Failed to search users" },
        { status: 500 }
      );
    }

    /* Also search auth.users by email using the admin client */
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    const { data: emailMatches, error: emailErr } = await (admin as any)
      .from("users")
      .select("id, email")
      .neq("id", userId)
      .ilike("email", `%${query}%`)
      .limit(10);

    if (emailErr) {
      console.error("[users/search] email query error:", emailErr);
    }

    /* Build a map of user ID → email from auth.users results */
    const emailMap = new Map<string, string>();
    for (const row of emailMatches ?? []) {
      emailMap.set(row.id as string, row.email as string);
    }

    /* Merge: start with name matches, enrich with emails from auth.users */
    const seen = new Set<string>();
    const users: Array<{
      id: string;
      name: string;
      avatar_url: string | null;
      email: string | null;
    }> = [];

    for (const u of nameMatches ?? []) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      users.push({
        id: u.id,
        name: u.name,
        avatar_url: u.avatar_url,
        email: emailMap.get(u.id) ?? null,
      });
    }

    /* Add users who matched only by email (not already included) */
    const emailOnlyIds = (emailMatches ?? [])
      .map((r) => r.id as string)
      .filter((id) => !seen.has(id));

    if (emailOnlyIds.length > 0 && users.length < 10) {
      const { data: extraUsers } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .in("id", emailOnlyIds);

      for (const u of extraUsers ?? []) {
        if (seen.has(u.id) || users.length >= 10) continue;
        seen.add(u.id);
        users.push({
          id: u.id,
          name: u.name,
          avatar_url: u.avatar_url,
          email: emailMap.get(u.id) ?? null,
        });
      }
    }

    return NextResponse.json({ users: users.slice(0, 10) });
  } catch (err) {
    console.error("[users/search] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
