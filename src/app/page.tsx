import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatView } from "@/components/chat/ChatView";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  /* Ensure public.users row exists (upsert for safety) */
  const userName =
    user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User";

  await supabase.from("users").upsert(
    { id: user.id, name: userName },
    { onConflict: "id" },
  ).ignore();

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
      userEmail={user.email}
    />
  );
}
