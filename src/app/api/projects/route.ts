import { loadPortfolio } from "@/lib/supabase/server/portfolio";
import { createSessionClient } from "@/lib/supabase/server/session";

const NO_STORE = { "cache-control": "no-store" };

export async function GET() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  }
  const { data: owner } = await supabase.rpc("is_owner");
  if (!owner) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  const portfolio = await loadPortfolio();
  if (portfolio === "unavailable") {
    return Response.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
  return Response.json(portfolio, { headers: NO_STORE });
}
