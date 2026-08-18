import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatView } from "@/components/chat/ChatView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const userName =
    user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User";

  /* Fire-and-forget upsert (non-blocking for the page render).
     The upsert is a safety net — a DB trigger should handle this already. */
  supabase
    .from("users")
    .upsert({ id: user.id, name: userName }, { onConflict: "id" })
    .catch(() => {});

  /* Fetch profile in parallel with the upsert */
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
