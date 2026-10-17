import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server/session";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  try {
    const code = requestUrl.searchParams.get("code");
    if (!code) throw new Error("missing code");
    const supabase = await createSessionClient();
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) throw exchanged.error;
    const owner = await supabase.rpc("is_owner");
    if (owner.error) throw owner.error;
    if (!owner.data) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/sign-in?reason=not_owner", requestUrl.origin), 303);
    }
    return NextResponse.redirect(new URL("/", requestUrl.origin), 303);
  } catch {
    return NextResponse.redirect(new URL("/sign-in?reason=auth_error", requestUrl.origin), 303);
  }
}
