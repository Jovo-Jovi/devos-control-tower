import { AgeText } from "@/components/AgeText";
import { Bidi } from "@/components/Bidi";
import { EvidenceLink } from "@/components/EvidenceLink";
import { OriginChip } from "@/components/OriginChip";
import { StatusChip } from "@/components/StatusChip";
import { formatCount } from "@/lib/portfolio/formatCount";
import type { ProjectRun, ProjectStepEvent, SeqGap } from "@/lib/project/aggregate";
import { executionWord, fill, type ProjectCopy } from "@/lib/project/copy";
import styles from "./Timeline.module.css";

function isGap(entry: ProjectStepEvent | SeqGap): entry is SeqGap {
  return "missing" in entry;
}

export function Timeline({
  run,
  repo,
  copy,
  enter = false,
}: {
  run: ProjectRun;
  repo: string;
  copy: ProjectCopy;
  enter?: boolean;
}) {
  return (
    <section className={styles.run} data-run={run.runKey}>
      <header className={styles.head}>
        <span className={styles.mono}>
          <Bidi>{run.runKey}</Bidi>
        </span>
        <span>{executionWord(copy, run.source)}</span>
        <span>{fill(copy.atRange, { from: run.firstAt ?? copy.unknown, to: run.lastAt ?? copy.unknown })}</span>
      </header>
      <ol className={styles.list} data-enter={enter ? "" : undefined}>
        {run.entries.map((entry) =>
          isGap(entry) ? (
            <li key={`gap-${entry.before}`} className={styles.gap} data-seq-gap="">
              {fill(copy.gap, { seq: formatCount(entry.before), count: formatCount(entry.missing) })}
            </li>
          ) : (
            <li
              key={entry.seq}
              className={styles.event}
              data-step-event=""
              data-run-key={run.runKey}
              data-seq={entry.seq}
            >
              <span className={styles.mono}>
                {copy.seq} {formatCount(entry.seq)}
              </span>{" "}
              <span className={styles.mono}>
                {entry.phase ?? copy.unknown} · {entry.task ?? copy.unknown}
              </span>{" "}
              <StatusChip
                step={entry.step}
                status={entry.status}
                still={entry.status === "started" && entry.open !== "running"}
              />{" "}
              {entry.open === "running" ? <span>{copy.running}</span> : null}
              {entry.open === "unfinished" ? <span>{copy.unfinished}</span> : null}{" "}
              <OriginChip origin={entry.origin} /> <AgeText at={entry.receivedAt} empty={copy.noContact} />{" "}
              {entry.evidence ? (
                <EvidenceLink
                  repo={repo}
                  commit={entry.evidence.commit}
                  path={entry.evidence.path}
                  text={
                    entry.evidence.path
                      ? `${entry.evidence.path}@${entry.evidence.commit}`
                      : `@${entry.evidence.commit}`
                  }
                />
              ) : (
                <span>{copy.unknown}</span>
              )}
            </li>
          ),
        )}
      </ol>
    </section>
  );
}
