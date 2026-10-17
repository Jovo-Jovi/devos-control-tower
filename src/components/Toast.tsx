"use client";

import { useEffect, useRef, useState } from "react";
import { tokenMs } from "@/lib/portfolio/readToken";
import styles from "./Toast.module.css";

export function Toast({ message }: { message: string }) {
  const [open, setOpen] = useState(true);
  const [paused, setPaused] = useState(false);
  const remaining = useRef<number | null>(null);

  useEffect(() => {
    if (!open || paused) return;
    const delay = remaining.current ?? tokenMs("--dur-toast");
    const started = Date.now();
    const id = window.setTimeout(() => setOpen(false), delay);
    return () => {
      remaining.current = Math.max(0, delay - (Date.now() - started));
      window.clearTimeout(id);
    };
  }, [open, paused]);

  if (!open) return null;
  return (
    <p
      className={styles.toast}
      role="status"
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {message}
    </p>
  );
}
