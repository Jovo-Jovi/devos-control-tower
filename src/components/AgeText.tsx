"use client";

import { useEffect, useState } from "react";
import { defaultLocale } from "@/i18n/config";
import styles from "./AgeText.module.css";

const UNITS = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
] as const;

export function formatAge(iso: string, now: number): string {
  const formatter = new Intl.RelativeTimeFormat(defaultLocale, { numeric: "auto" });
  let value = (Date.parse(iso) - now) / 1000;
  for (const unit of UNITS) {
    if (Math.abs(value) < unit.amount) {
      return formatter.format(Math.round(value), unit.unit);
    }
    value /= unit.amount;
  }
  return formatter.format(Math.round(value), "year");
}

export function AgeText({ at, empty }: { at: string | null; empty: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!at) return <span className={styles.age}>{empty}</span>;
  const date = new Date(at);
  return (
    <time className={styles.age} dateTime={date.toISOString()} title={date.toISOString()} suppressHydrationWarning>
      {formatAge(at, now)}
    </time>
  );
}
