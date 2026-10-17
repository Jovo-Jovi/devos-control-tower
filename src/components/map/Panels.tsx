"use client";

import { useEffect, useState } from "react";
import { AgeText } from "@/components/AgeText";
import { Counter } from "@/components/Counter";
import { OriginChip } from "@/components/OriginChip";
import { LINK_STATES, type Portfolio } from "@/lib/portfolio/aggregate";
import type { OverviewCopy } from "@/lib/portfolio/copy";
import { formatCount } from "@/lib/portfolio/formatCount";
import styles from "./Panels.module.css";

export function Panels({
  copy,
  portfolio,
  mode,
}: {
  copy: OverviewCopy;
  portfolio: Portfolio | null;
  mode: "loading" | "figures" | "hidden";
}) {
  const [move, setMove] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMove(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  const totals = portfolio?.totals;
  const seen = totals?.tasksSeen ?? 0;
  const passed = totals?.tasksPassed ?? 0;
  const scale = seen === 0 ? 0 : Math.max(0, Math.min(100, Math.round((passed / seen) * 100)));
  return (
    <div className={styles.grid}>
      <section className={styles.panel} aria-label={copy.system}>
        <h2>{copy.system}</h2>
        {mode === "loading" ? (
          <span className={styles.skeleton} />
        ) : (
          <>
            <span className={styles.ringWrap}>
              <svg className={styles.ring} viewBox="0 0 120 120" aria-hidden="true" data-move={move ? "" : undefined}>
                <circle className={styles.track} cx="60" cy="60" r="48" />
                {mode === "figures" && seen > 0 ? (
                  <circle
                    className={styles.arc}
                    cx="60"
                    cy="60"
                    r="48"
                    pathLength="100"
                    strokeDasharray="100"
                    strokeDashoffset={100 - scale}
                  />
                ) : null}
              </svg>
              <span className={styles.ringValue}>
                {mode === "figures" ? <Counter value={passed} /> : copy.unknown}
              </span>
            </span>
            <p>
              {mode === "figures" ? `${formatCount(passed)} / ${formatCount(seen)}` : copy.unknown} {copy.ofTasks}
            </p>
            <ul className={styles.states}>
              {LINK_STATES.map((state) => (
                <li key={state}>
                  <span>{copy.link[state]}</span>
                  <span>{mode === "figures" ? formatCount(totals?.byLinkState[state] ?? 0) : copy.unknown}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className={styles.panel} aria-label={copy.activity}>
        <h2>{copy.activity}</h2>
        {mode === "loading" ? <span className={styles.skeleton} /> : null}
        {mode === "figures" ? (
          <ol className={styles.activity}>
            {portfolio?.recentActivity.map((event, index) => (
              <li key={`${event.key}-${event.receivedAt}-${event.seq}-${event.step}`} data-activity-row="" data-rise={index === 0 ? "" : undefined}>
                <span className={styles.key}>{event.key}</span>
                <span>
                  {event.task ? `${event.task} · ` : ""}
                  {event.step} · {event.status}
                </span>
                <OriginChip origin={event.origin} />
                <AgeText at={event.receivedAt} empty={copy.noContact} />
              </li>
            ))}
          </ol>
        ) : null}
      </section>
      <section className={styles.panel} aria-label={copy.health}>
        <h2>{copy.health}</h2>
        {mode === "loading" ? <span className={styles.skeleton} /> : null}
        {mode === "hidden" ? <p>{copy.unknown}</p> : null}
        {mode === "figures" && portfolio ? (
          <dl className={styles.health}>
            <dt>{copy.lastReceived}</dt>
            <dd data-health="last">
              <AgeText at={portfolio.health.lastReceivedAt} empty={copy.noContact} />
            </dd>
            <dt>{copy.hour}</dt>
            <dd data-health="hour">{formatCount(portfolio.health.stepEventsLastHour)}</dd>
            <dt>{copy.deliveries}</dt>
            <dd data-health="deliveries">{formatCount(portfolio.health.deliveriesLast24h)}</dd>
            <dt>{copy.rejections}</dt>
            <dd data-health="rejections">{formatCount(portfolio.health.rejectionsLast24h)}</dd>
          </dl>
        ) : null}
      </section>
    </div>
  );
}
