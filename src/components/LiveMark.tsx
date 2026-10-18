"use client";

import { usePollStatus } from "./PollStatus";
import styles from "./LiveMark.module.css";

export function LiveMark({ live, offline }: { live: string; offline: string }) {
  const status = usePollStatus();
  return (
    <span className={styles.slot}>
      <span className={styles.sizer} aria-hidden="true">
        {offline}
      </span>
      {status === "idle" ? null : (
        <span className={styles.mark} data-status={status}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.word}>
            <span className={status === "live" ? undefined : styles.quiet}>{live}</span>
            <span className={status === "offline" ? undefined : styles.quiet}>{offline}</span>
          </span>
        </span>
      )}
    </span>
  );
}
