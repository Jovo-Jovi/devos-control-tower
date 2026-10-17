"use client";

import { useEffect, useState } from "react";
import { formatCount } from "@/lib/portfolio/formatCount";
import styles from "./Bar.module.css";

export function Bar({ passed, seen, dash }: { passed: number; seen: number; dash: string }) {
  const [move, setMove] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMove(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  const empty = seen === 0;
  const scale = empty ? 0 : Math.max(0, Math.min(100, Math.round((passed / seen) * 100)));
  return (
    <span className={styles.row}>
      <span
        className={styles.track}
        data-bar-track=""
        data-empty={empty ? "" : undefined}
        data-move={move ? "" : undefined}
      >
        {empty ? null : (
          <svg className={styles.meter} viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true">
            <line
              className={styles.stroke}
              x1="0"
              y1="0.5"
              x2="100"
              y2="0.5"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - scale}
              strokeWidth="1"
            />
          </svg>
        )}
      </span>
      <span className={styles.value}>{empty ? dash : `${formatCount(passed)} / ${formatCount(seen)}`}</span>
    </span>
  );
}
