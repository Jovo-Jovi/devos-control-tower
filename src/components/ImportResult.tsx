import { Bidi } from "@/components/Bidi";
import { OriginChip } from "@/components/OriginChip";
import { formatCount } from "@/lib/portfolio/formatCount";
import styles from "./ImportResult.module.css";

function RunLabel({ template, run }: { template: string; run: string }) {
  const token = "{run}";
  const index = template.indexOf(token);
  if (index < 0) return <Bidi>{run}</Bidi>;
  return (
    <>
      {template.slice(0, index)}
      <Bidi>{run}</Bidi>
      {template.slice(index + token.length)}
    </>
  );
}

export function ImportResult({
  projectKey,
  run,
  stored,
  duplicate,
  conflict,
  runTemplate,
  storedLabel,
  duplicateLabel,
  conflictLabel,
  viewLabel,
}: {
  projectKey: string;
  run: string;
  stored: number;
  duplicate: number;
  conflict: number;
  runTemplate: string;
  storedLabel: string;
  duplicateLabel: string;
  conflictLabel: string;
  viewLabel: string;
}) {
  const rows = [
    { label: storedLabel, value: stored },
    { label: duplicateLabel, value: duplicate },
    { label: conflictLabel, value: conflict },
  ];

  return (
    <section className={styles.result}>
      <table className={styles.table} data-import-result="">
        <caption className={styles.caption}>
          <span className={styles.run}>
            <RunLabel template={runTemplate} run={run} />
          </span>
          <OriginChip origin="imported" />
        </caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={styles.row}>
              <th className={styles.label} scope="row">
                {row.label}
              </th>
              <td className={styles.count}>{formatCount(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <a className={styles.view} href={`/projects/${projectKey}`}>
        {viewLabel}
      </a>
    </section>
  );
}
