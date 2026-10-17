"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";
import styles from "./SignInCard.module.css";

export function SignInButton({ label }: { label: string }) {
  async function onSignIn() {
    const supabase = createBrowserSupabase();
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo },
    });
  }

  return (
    <button type="button" className={styles.button} onClick={onSignIn}>
      {label}
    </button>
  );
}
