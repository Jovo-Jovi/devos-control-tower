import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export type SessionCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax" | "None" | "Strict";
  expires?: number;
};

const FIXTURES = [
  { githubId: "700001", login: "fixture-owner" },
  { githubId: "700002", login: "fixture-other" },
] as const;

function localEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const text = readFileSync(".devos/supabase.env", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)='(.*)'$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function psql(sql: string): void {
  const dbUrl = localEnv().SUPABASE_DB_URL;
  if (!dbUrl) throw new Error("SUPABASE_DB_URL is not set");
  try {
    execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error ? String((error as { stderr?: Buffer }).stderr) : "";
    throw new Error(stderr.replaceAll(dbUrl, "[redacted]") || "psql failed");
  }
}

function admin() {
  const env = localEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase local environment is not set");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function sameSite(value: CookieOptions["sameSite"]): SessionCookie["sameSite"] {
  if (value === "strict" || value === true) return "Strict";
  if (value === "none") return "None";
  return "Lax";
}

export async function createOwner({
  githubId,
  login,
  allowListed,
}: {
  githubId: string;
  login: string;
  allowListed: boolean;
}): Promise<void> {
  if (!/^\d+$/.test(githubId) || !/^[a-z0-9-]+$/.test(login)) {
    throw new Error("fixture id is not synthetic");
  }
  const email = `${login}@example.test`;
  const created = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? "createUser failed");
  const identity = JSON.stringify({ sub: githubId, user_name: login });
  psql(
    `insert into auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at) values ('${created.data.user.id}', 'github', '${githubId}', $json$${identity}$json$::jsonb, now(), now());`,
  );
  if (allowListed) psql(`insert into public.owner_allowlist (github_id) values ('${githubId}');`);
}

export async function sessionCookies(email: string): Promise<SessionCookie[]> {
  const env = localEnv();
  const linked = await admin().auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = linked.data.properties?.hashed_token;
  if (linked.error || !tokenHash) throw new Error(linked.error?.message ?? "generateLink failed");

  const collected: { name: string; value: string; options: CookieOptions }[] = [];
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet) {
        collected.push(...cookiesToSet);
      },
    },
  });
  const verified = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verified.error) throw new Error(verified.error.message);

  return collected.map(({ name, value, options }) => {
    const cookie: SessionCookie = {
      name,
      value,
      domain: "127.0.0.1",
      path: options.path ?? "/",
      httpOnly: options.httpOnly ?? false,
      secure: false,
      sameSite: sameSite(options.sameSite),
    };
    if (typeof options.maxAge === "number") cookie.expires = Math.floor(Date.now() / 1000) + options.maxAge;
    return cookie;
  });
}

export async function removeOwner(): Promise<void> {
  const emails = FIXTURES.map((fixture) => `'${fixture.login}@example.test'`).join(", ");
  const ids = FIXTURES.map((fixture) => `'${fixture.githubId}'`).join(", ");
  psql(
    `delete from public.owner_allowlist where github_id in (${ids}); delete from auth.users where email in (${emails});`,
  );
}
