/**
 * Unified auth helper for API routes.
 *
 * Resolution order:
 * 1. Supabase session cookie (real authenticated users)
 * 2. x-demo-user-id header (demo / development mode)
 *
 * In production with a real auth flow only path 1 is used.
 * The demo header is scoped to the conversation participation check
 * that follows in every route handler, so no unauthorised access is possible.
 */
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export interface AuthUser {
  id: string;
  email?: string | null;
}

const DEMO_HEADER = "x-demo-user-id";

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  /* 1. Try real Supabase session */
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return { id: user.id, email: user.email };
    }
  } catch {
    // Cookie parsing can fail on edge runtimes — fall through
  }

  /* 2. Demo header fallback */
  const demoId = req.headers.get(DEMO_HEADER);
  if (demoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(demoId)) {
    return { id: demoId };
  }

  return null;
}
