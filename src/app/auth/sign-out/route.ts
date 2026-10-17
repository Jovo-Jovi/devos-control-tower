import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server/session";

export async function POST() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
