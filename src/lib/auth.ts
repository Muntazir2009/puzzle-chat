/**
 * Unified auth helper for API routes.
 *
 * In production: reads the Supabase session cookie.
 * The middleware guarantees that only authenticated requests reach API routes,
 * so the Supabase `getUser()` call here is the single source of truth.
 */
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export interface AuthUser {
  id: string;
  email?: string | null;
}

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
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

  return null;
}
