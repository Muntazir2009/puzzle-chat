import { redirect } from "next/navigation";
import { ChatView } from "@/components/chat/ChatView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  let userId = "";
  let userName = "User";
  let userAvatar: string | null = null;
  let userEmail: string | null = null;

  try {
    /* Dynamic import keeps Supabase off the cold-start critical path
       and avoids crashes when the module cannot resolve at build time. */
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    userId = user.id;
    userEmail = user.email ?? null;
    userName =
      user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User";

    /* Fire-and-forget upsert (non-blocking for the page render). */
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

    if (profile) {
      userName = profile.name ?? userName;
      userAvatar = profile.avatar_url ?? null;
    }
  } catch (err) {
    /* If Supabase is unreachable or cookies() fails on the edge,
       fall back to the login page rather than showing a 500. */
    console.error("[page] SSR auth failed:", err);
    redirect("/login");
  }

  return (
    <ChatView
      userId={userId}
      userName={userName}
      userAvatar={userAvatar}
      userEmail={userEmail}
    />
  );
}
