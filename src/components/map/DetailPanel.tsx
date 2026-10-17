"use client";

import { useEffect, useId } from "react";
import { Bidi } from "@/components/Bidi";
import { AgeText } from "@/components/AgeText";
import { Bar } from "@/components/Bar";
import { OriginChip } from "@/components/OriginChip";
import { StatusChip } from "@/components/StatusChip";
import type { PortfolioProject } from "@/lib/portfolio/aggregate";
import { executionWord, type OverviewCopy } from "@/lib/portfolio/copy";
import styles from "./DetailPanel.module.css";

export function DetailPanel({
  project,
  copy,
  onClose,
}: {
  project: PortfolioProject;
  copy: OverviewCopy;
  onClose: () => void;
}) {
  const titleId = useId();
  const latest = project.latest;

  useEffect(() => {
    const close = document.getElementById("detail-close");
    if (close instanceof HTMLElement) close.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, project.key]);

  return (
    <aside className={styles.panel} role="dialog" aria-labelledby={titleId}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {project.key}
        </h2>
        <button id="detail-close" className={styles.close} type="button" onClick={onClose}>
          {copy.close}
        </button>
      </div>
      {latest ? <StatusChip step={latest.step} status={latest.status} /> : null}
      <dl className={styles.facts}>
        <dt>{copy.repository}</dt>
        <dd>
          <a href={`https://github.com/${project.repo}`} rel="noreferrer">
            <Bidi>{project.repo}</Bidi>
          </a>
        </dd>
        <dt>{copy.execution}</dt>
        <dd>{executionWord(copy, project.execution)}</dd>
        <dt>{copy.tasks}</dt>
        <dd>
          <Bar passed={project.tasks.passed} seen={project.tasks.seen} dash={copy.unknown} />
          <span>{copy.ofSeen}</span>
        </dd>
        <dt>{copy.phase}</dt>
        <dd>
          <span>{project.phase?.id ?? copy.unknown}</span>
          <Bar passed={project.phase?.passed ?? 0} seen={project.phase?.seen ?? 0} dash={copy.unknown} />
        </dd>
        <dt>{copy.latest}</dt>
        <dd>
          {latest
            ? `${latest.task ? `${latest.task} · ` : ""}${latest.step} · ${latest.status}`
            : copy.unknown}
        </dd>
        <dt>{copy.fact}</dt>
        <dd>
          {latest ? <OriginChip origin={latest.origin} /> : <span>{copy.unknown}</span>}
          <AgeText at={latest?.receivedAt ?? project.lastContactAt} empty={copy.noContact} />
        </dd>
      </dl>
      <h3 className={styles.recent}>{copy.recent}</h3>
      <ol className={styles.events}>
        {project.recent.map((event) => (
          <li key={`${event.seq}-${event.step}-${event.receivedAt}`}>
            <span>{event.seq}</span>
            <span>
              {event.task ? `${event.task} · ` : ""}
              {event.step} · {event.status}
            </span>
            <OriginChip origin={event.origin} />
            <AgeText at={event.receivedAt} empty={copy.noContact} />
          </li>
        ))}
      </ol>
      <a className={styles.repository} href={`https://github.com/${project.repo}`} rel="noreferrer">
        {copy.repository}
      </a>
    </aside>
  );
}
