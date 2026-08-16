import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatView } from "@/components/chat/ChatView";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  /* Ensure public.users row exists */
  const { data: profile } = await supabase
    .from("users")
    .select("id, name, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) {
    await supabase.from("users").insert({
      id: user.id,
      name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User",
    });
  }

  const userName =
    profile?.name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "User";
  const userAvatar = profile?.avatar_url ?? null;

  return (
    <ChatView
      userId={user.id}
      userName={userName}
      userAvatar={userAvatar}
      userEmail={user.email}
    />
  );
}
