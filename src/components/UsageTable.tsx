import type { ReactNode } from "react";
import { AgeText } from "@/components/AgeText";
import { Bidi } from "@/components/Bidi";
import { OriginChip } from "@/components/OriginChip";
import { StatusChip } from "@/components/StatusChip";
import { formatCount } from "@/lib/portfolio/formatCount";
import type { UsageAttempt } from "@/lib/usage/aggregate";
import type { UsageCopy } from "@/lib/usage/copy";
import styles from "./UsageTable.module.css";

function shown(value: number | null, dash: string): string {
  return value === null ? dash : formatCount(value);
}

function groupTitle(row: UsageAttempt, copy: UsageCopy): string {
  return `${copy.phase} ${row.phase ?? copy.unknown} · ${copy.task} ${row.task ?? copy.unknown}`;
}

function Cell({
  label,
  children,
  numeric = false,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  numeric?: boolean;
  mono?: boolean;
}) {
  return (
    <td className={numeric ? `${styles.cell} ${styles.number}` : styles.cell}>
      <span className={styles.cellLabel}>{label}</span>
      {mono ? <span className={styles.mono}>{children}</span> : children}
    </td>
  );
}

export function UsageTable({ attempts, copy }: { attempts: readonly UsageAttempt[]; copy: UsageCopy }) {
  const rows: ReactNode[] = [];
  let previous = "";
  for (const row of attempts) {
    const group = `${row.phase ?? ""}\u0000${row.task ?? ""}`;
    if (group !== previous) {
      previous = group;
      rows.push(
        <tr key={`group-${group}`} className={`${styles.rise} ${styles.group}`} data-task-group="">
          <th scope="colgroup" colSpan={10}>{groupTitle(row, copy)}</th>
        </tr>,
      );
    }
    rows.push(
      <tr
        key={`${row.phase ?? ""}-${row.task ?? ""}-${row.runKey}-${row.agent}-${row.model}-${row.accountAlias}`}
        className={`${styles.rise} ${styles.row}`}
        data-attempt-row=""
      >
        <Cell label={copy.run} mono>
          <Bidi>{row.runKey}</Bidi>
        </Cell>
        <Cell label={copy.agent} mono>
          <Bidi>{row.agent}</Bidi>
        </Cell>
        <Cell label={copy.model} mono>
          <Bidi>{row.model}</Bidi>
        </Cell>
        <Cell label={copy.alias} mono>
          <Bidi>{row.accountAlias}</Bidi>
        </Cell>
        <Cell label={copy.input} numeric>
          {shown(row.input, copy.unknown)}
        </Cell>
        <Cell label={copy.output} numeric>
          {shown(row.output, copy.unknown)}
        </Cell>
        <Cell label={copy.cacheRead} numeric>
          {shown(row.cacheRead, copy.unknown)}
        </Cell>
        <Cell label={copy.cacheWrite} numeric>
          {shown(row.cacheWrite, copy.unknown)}
        </Cell>
        <Cell label={copy.source} mono>
          <Bidi>{row.source}</Bidi>
        </Cell>
        <td className={styles.cell}>
          <span className={styles.cellLabel}>{copy.result}</span>
          <span className={styles.result}>
            <StatusChip step={row.step} status={row.status} />
            <OriginChip origin={row.origin} />
            <AgeText at={row.receivedAt} empty={copy.noContact} />
          </span>
        </td>
      </tr>,
    );
  }

  return (
    <table className={styles.table} data-usage-table="">
      <thead>
        <tr className={styles.head}>
          <th scope="col">{copy.run}</th>
          <th scope="col">{copy.agent}</th>
          <th scope="col">{copy.model}</th>
          <th scope="col">{copy.alias}</th>
          <th scope="col">{copy.input}</th>
          <th scope="col">{copy.output}</th>
          <th scope="col">{copy.cacheRead}</th>
          <th scope="col">{copy.cacheWrite}</th>
          <th scope="col">{copy.source}</th>
          <th scope="col">{copy.result}</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}
