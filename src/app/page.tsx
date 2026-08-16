import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChatView } from "@/components/chat/ChatView";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  /* Ensure public.users row exists (safety net if trigger failed) */
  const userName =
    user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User";

  try {
    /* Try with the regular (RLS-respecting) client first */
    const { error: upsertErr } = await supabase
      .from("users")
      .upsert({ id: user.id, name: userName }, { onConflict: "id" });

    /* If RLS blocked the insert (user_insert_self policy needs auth.uid()),
       fall back to the admin client which bypasses RLS entirely */
    if (upsertErr) {
      console.warn("[page.tsx] regular upsert failed, trying admin client:", upsertErr.message);
      const admin = createAdminClient();
      await admin
        .from("users")
        .upsert({ id: user.id, name: userName }, { onConflict: "id" });
    }
  } catch (err) {
    console.error("[page.tsx] profile upsert error (non-blocking):", err);
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <ChatView
      userId={user.id}
      userName={profile?.name ?? userName}
      userAvatar={profile?.avatar_url ?? null}
      userEmail={user.email ?? null}
    />
  );
}
