import { createSessionClient } from "@/lib/supabase/server/session";

export async function GET() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthenticated" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const { data: owner } = await supabase.rpc("is_owner");
  if (!owner) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  return Response.json([], { headers: { "cache-control": "no-store" } });
}
