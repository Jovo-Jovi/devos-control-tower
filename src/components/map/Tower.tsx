import { ProductMark } from "@/components/ProductMark";
import type { OverviewCopy } from "@/lib/portfolio/copy";
import styles from "./Tower.module.css";

const MODULES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export function Tower({
  copy,
  stateWord,
  projects,
  fresh,
  stale,
  last,
  flashModules,
}: {
  copy: OverviewCopy;
  stateWord: string;
  projects: string;
  fresh: string;
  stale: string;
  last: React.ReactNode;
  flashModules: readonly number[];
}) {
  return (
    <div className={styles.tower} aria-hidden="true">
      <span className={styles.beam} />
      <span className={styles.glow} />
      <span className={styles.base} />
      <span className={`${styles.ring} ${styles.ring1}`} />
      <span className={`${styles.ring} ${styles.ring2}`} />
      <span className={`${styles.ring} ${styles.ring3}`} />
      <span className={`${styles.fin} ${styles.finStart}`} />
      <span className={`${styles.fin} ${styles.finEnd}`} />
      <span className={styles.crown} />
      <span className={styles.body} />
      <span className={styles.seam} />
      <span className={styles.plate}>
        <ProductMark />
        <span className={styles.word}>{copy.productWord}</span>
        <span className={styles.caption}>{copy.towerTitle}</span>
      </span>
      <span className={styles.panel}>
        <span className={styles.state}>
          <span className={styles.led} />
          {stateWord}
        </span>
        <span className={styles.fact}>
          <span>{copy.projects}</span>
          <span>{projects}</span>
        </span>
        <span className={styles.fact}>
          <span>{copy.fresh}</span>
          <span>{fresh}</span>
        </span>
        <span className={styles.fact}>
          <span>{copy.staleOrSilent}</span>
          <span>{stale}</span>
        </span>
        <span className={styles.fact}>
          <span>{copy.lastReceived}</span>
          <span>{last}</span>
        </span>
      </span>
      {MODULES.map((module) => (
        <span key={module} className={styles.module} data-module={module}>
          <span className={styles.moduleLed} />
          <span className={styles.slotLine} />
          <span className={styles.moduleLed} />
          {flashModules.includes(module) ? <span className={styles.moduleFlash} /> : null}
        </span>
      ))}
    </div>
  );
}
