import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server/session";

export async function POST(request: Request) {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
