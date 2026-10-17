"use client";

import { usePollStatus } from "./PollStatus";
import styles from "./LiveMark.module.css";

export function LiveMark({ live, offline }: { live: string; offline: string }) {
  const status = usePollStatus();
  if (status === "idle") return null;
  return (
    <span className={styles.mark} data-status={status}>
      <span className={styles.dot} aria-hidden="true" />
      {status === "live" ? live : offline}
    </span>
  );
}
