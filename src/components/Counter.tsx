"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { formatCount } from "@/lib/portfolio/formatCount";
import { tokenEase, tokenSeconds } from "@/lib/portfolio/readToken";
import styles from "./Counter.module.css";

export function Counter({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value || reduced !== false) {
      setShown(value);
      return;
    }
    const controls = animate(from, value, {
      duration: tokenSeconds("--dur-slow"),
      ease: tokenEase("--ease-in-out"),
      onUpdate: (next) => setShown(next),
    });
    return () => controls.stop();
  }, [reduced, value]);

  return <span className={styles.value}>{formatCount(Math.round(shown))}</span>;
}
