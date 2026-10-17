import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase publishable environment is not set");
  }
  return createBrowserClient(url, key);
}
