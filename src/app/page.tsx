import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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

  const userName = profile?.name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User";

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
          <svg className="size-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Puzzle</span>
          <span className="text-xs text-muted-foreground">Signed in as {userName}</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-600/10">
          <svg className="size-8 stroke-1 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium">Welcome, {userName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your conversations will appear here.
            <br />
            Start a new chat to begin messaging.
          </p>
        </div>
      </div>

      <footer className="mt-auto border-t px-4 py-3">
        <p className="text-center text-xs text-muted-foreground">Puzzle &middot; Phase 1 coming soon</p>
      </footer>
    </div>
  );
}
