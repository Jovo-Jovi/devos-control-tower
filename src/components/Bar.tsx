"use client";

import { useEffect, useState } from "react";
import styles from "./Bar.module.css";

export function Bar({ passed, seen, dash }: { passed: number; seen: number; dash: string }) {
  const [move, setMove] = useState(false);
  useEffect(() => setMove(true), []);
  const empty = seen === 0;
  const scale = empty ? 0 : Math.max(0, Math.min(100, Math.round((passed / seen) * 100)));
  return (
    <span className={styles.row}>
      <span className={styles.track} data-empty={empty ? "" : undefined}>
        {empty ? null : (
          <span className={styles.fill} data-scale={scale} data-move={move ? "" : undefined} />
        )}
      </span>
      <span className={styles.value}>{empty ? dash : `${passed} / ${seen}`}</span>
    </span>
  );
}
