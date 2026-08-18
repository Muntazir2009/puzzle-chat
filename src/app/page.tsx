import { headers } from "next/headers";
import { ChatView } from "@/components/chat/ChatView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  /* The middleware already validated the session and injected user info
     into request headers. Read them here to avoid a second Supabase call
     that would require cookies() on the edge. */
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "";
  const userEmail = headersList.get("x-user-email") ?? null;

  /* If middleware didn't set headers (shouldn't happen), the client-side
     auth check in ChatView will redirect to /login. */
  const userName = userEmail?.split("@")[0] ?? "User";

  /* Try to fetch profile from Supabase for avatar + display name.
     If this fails on the edge, ChatView still works with defaults. */
  let userAvatar: string | null = null;
  if (userId) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: profile } = await supabase
        .from("users")
        .select("name, avatar_url")
        .eq("id", userId)
        .single();
      if (profile) {
        userAvatar = profile.avatar_url ?? null;
      }
    } catch {
      // Non-critical — avatar is optional
    }
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
