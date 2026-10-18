import { fill } from "@/lib/portfolio/copy";
import { formatCount } from "@/lib/portfolio/formatCount";
import type { UsageCoverage } from "@/lib/usage/aggregate";
import styles from "./CoverageLine.module.css";

export function CoverageLine({
  coverage,
  template,
}: {
  coverage: readonly UsageCoverage[];
  template: string;
}) {
  return (
    <p className={styles.line}>
      {coverage.map((row, index) => (
        <span key={row.agent}>
          {index > 0 ? " · " : null}
          <span data-coverage={row.agent}>
            {fill(template, {
              agent: row.agent,
              measured: formatCount(row.measured),
              ended: formatCount(row.ended),
            })}
          </span>
        </span>
      ))}
    </p>
  );
}
