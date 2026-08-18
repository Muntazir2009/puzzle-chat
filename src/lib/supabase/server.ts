import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Server-side Supabase client.
 *
 * Validates env vars at call-time (not import-time) so the module
 * tree can be statically analysed and the UI still renders when
 * credentials are not yet configured.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
        "Set it in .env.local or your deployment platform."
    );
  }

  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. " +
        "Set it in .env.local or your deployment platform."
    );
  }

  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    /* On some edge runtimes (e.g. Cloudflare Workers) the cookies()
       API may not be available in certain contexts. Fall back to
       a no-op cookie jar so the client can at least be created. */
    cookieStore = {
      getAll: () => [],
      set: () => {},
    } as unknown as Awaited<ReturnType<typeof cookies>>;
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* setAll is called from Server Components and can be
             safely ignored when middleware handles refresh. */
        }
      },
    },
  });
}
