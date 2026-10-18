"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StatusChip.module.css";

export function StatusChip({ step, status, still = false }: { step: string; status: string; still?: boolean }) {
  const label = `${step} · ${status}`;
  const [flash, setFlash] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setFlash((current) => current + 1);
  }, [label]);

  return (
    <span className={styles.chip} data-status={status}>
      {flash > 0 ? <span key={flash} className={styles.flash} aria-hidden="true" /> : null}
      {status === "started" && !still ? <span className={styles.dot} data-live-dot="" aria-hidden="true" /> : null}
      {label}
    </span>
  );
}
