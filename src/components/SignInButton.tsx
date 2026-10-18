"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import styles from "./SignInCard.module.css";

export function SignInButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const [pending, setPending] = useState(false);

  async function onSignIn() {
    setPending(true);
    const supabase = createBrowserSupabase();
    const redirectTo = `${window.location.origin}/auth/callback`;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo },
      });
      if (error) setPending(false);
    } catch {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={styles.button}
      data-sign-in-button=""
      aria-busy={pending}
      disabled={pending}
      onClick={onSignIn}
    >
      <span className={styles.face}>
        <span className={styles.idle} aria-hidden={pending ? true : undefined}>
          {label}
        </span>
        <span className={styles.pending} role="status" aria-hidden={pending ? undefined : true}>
          <span className={styles.dots} aria-hidden="true">
            <span className={styles.dot} />
            <span className={`${styles.dot} ${styles.dot2}`} />
            <span className={`${styles.dot} ${styles.dot3}`} />
          </span>
          {pendingLabel}
        </span>
      </span>
    </button>
  );
}
