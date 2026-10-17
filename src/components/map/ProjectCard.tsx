"use client";

import { Bidi } from "@/components/Bidi";
import { AgeText, formatAge } from "@/components/AgeText";
import { Bar } from "@/components/Bar";
import { OriginChip } from "@/components/OriginChip";
import { StatusChip } from "@/components/StatusChip";
import type { PortfolioProject } from "@/lib/portfolio/aggregate";
import { executionWord, fill, type OverviewCopy } from "@/lib/portfolio/copy";
import styles from "./ProjectCard.module.css";

export function cardLabel(copy: OverviewCopy, project: PortfolioProject, now: number): string {
  return fill(copy.cardLabel, {
    key: project.key,
    state: copy.link[project.linkState],
    passed: String(project.tasks.passed),
    seen: String(project.tasks.seen),
    step: project.latest ? `${project.latest.step} · ${project.latest.status}` : copy.unknown,
    origin: project.latest?.origin ?? copy.unknown,
    age: project.lastContactAt ? formatAge(project.lastContactAt, now) : copy.noContact,
  });
}

export function ProjectCard({
  project,
  copy,
  now,
  slot,
  placement,
  dimmed,
  selected,
  flash,
  tint,
  onSelect,
}: {
  project: PortfolioProject;
  copy: OverviewCopy;
  now: number;
  slot?: number;
  placement: "map" | "list";
  dimmed?: "filter" | "panel";
  selected: boolean;
  flash: number;
  tint: boolean;
  onSelect: (key: string) => void;
}) {
  const latest = project.latest;
  const execution = executionWord(copy, project.execution);
  return (
    <button
      id={`${placement}-card-${project.key}`}
      type="button"
      className={placement === "map" ? styles.mapCard : styles.listCard}
      data-map-card={placement === "map" ? "" : undefined}
      data-list-card={placement === "list" ? "" : undefined}
      data-project={project.key}
      data-card-key={project.key}
      data-link-state={project.linkState}
      data-slot={slot}
      data-dimmed={dimmed}
      data-tint={tint ? "" : undefined}
      aria-pressed={selected}
      aria-label={cardLabel(copy, project, now)}
      onClick={() => onSelect(project.key)}
    >
      {flash > 0 ? <span key={flash} className={styles.flash} aria-hidden="true" /> : null}
      <span className={styles.identity}>
        <span className={styles.monogram} aria-hidden="true">
          {project.key.slice(0, 2)}
        </span>
        <span className={styles.names}>
          <span className={styles.key}>{project.key}</span>
          <Bidi>
            <span className={styles.repo}>{project.repo}</span>
          </Bidi>
        </span>
        {latest ? <StatusChip step={latest.step} status={latest.status} /> : null}
      </span>
      <span className={styles.execution}>{execution}</span>
      <span className={styles.metric}>
        <span>{copy.tasks}</span>
        <Bar passed={project.tasks.passed} seen={project.tasks.seen} dash={copy.unknown} />
        <span>{copy.ofSeen}</span>
      </span>
      <span className={styles.metric}>
        <span>
          {copy.phase}
          {project.phase ? ` ${project.phase.id}` : ""}
        </span>
        <Bar passed={project.phase?.passed ?? 0} seen={project.phase?.seen ?? 0} dash={copy.unknown} />
        <span>{copy.ofSeen}</span>
      </span>
      <span className={styles.fact}>
        <span>
          {latest
            ? `${latest.task ? `${latest.task} · ` : ""}${latest.step} · ${latest.status}`
            : copy.unknown}
        </span>
        {latest ? <OriginChip origin={latest.origin} /> : null}
        <AgeText at={project.lastContactAt} empty={copy.noContact} />
      </span>
    </button>
  );
}
