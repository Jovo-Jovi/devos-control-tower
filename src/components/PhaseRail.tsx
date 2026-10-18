import { AgeText } from "@/components/AgeText";
import { OriginChip } from "@/components/OriginChip";
import { StatusChip } from "@/components/StatusChip";
import type { ProjectPhase } from "@/lib/project/aggregate";
import type { ProjectCopy } from "@/lib/project/copy";
import styles from "./PhaseRail.module.css";

export function PhaseRail({ phases, copy }: { phases: ProjectPhase[]; copy: ProjectCopy }) {
  return (
    <div data-phase-rail="">
      <div className={styles.rail}>
        {phases.map((phase) => {
          const id = phase.id ?? copy.unknown;
          return (
            <div key={id} className={styles.segment} data-phase={id}>
              <span className={styles.mono}>{id}</span>
              {phase.tasks.map((task) => (
                <span
                  key={task.task}
                  className={styles.tick}
                  aria-hidden="true"
                  data-task-tick={task.task}
                  data-status={task.status}
                />
              ))}
            </div>
          );
        })}
      </div>
      <ul className={styles.tasks}>
        {phases.flatMap((phase) =>
          phase.tasks.map((task) => (
            <li key={task.task} className={styles.task} data-task-row={task.task}>
              <span className={styles.mono}>{task.task}</span> <StatusChip step={task.step} status={task.status} still />{" "}
              <OriginChip origin={task.origin} /> <AgeText at={task.receivedAt} empty={copy.noContact} />
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
