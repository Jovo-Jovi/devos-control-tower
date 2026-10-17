import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function publishableEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase publishable environment is not set");
  }
  return { url, key };
}

export async function createSessionClient() {
  const cookieStore = await cookies();
  const { url, key } = publishableEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the session.
        }
      },
    },
  });
}

function identityText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function requireOwner(): Promise<{ login: string; avatarUrl: string | null }> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: owner } = await supabase.rpc("is_owner");
  if (!owner) {
    await supabase.auth.signOut();
    redirect("/sign-in?reason=not_owner");
  }

  const identity = user.identities?.find((row) => row.provider === "github");
  const identityData = identity?.identity_data;
  const login = identityText(identityData?.user_name) ?? "";
  const avatarUrl = identityText(identityData?.avatar_url);
  return { login, avatarUrl };
}
