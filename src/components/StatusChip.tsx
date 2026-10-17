"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StatusChip.module.css";

export function StatusChip({ step, status }: { step: string; status: string }) {
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
      {status === "started" ? <span className={styles.dot} aria-hidden="true" /> : null}
      {label}
    </span>
  );
}
