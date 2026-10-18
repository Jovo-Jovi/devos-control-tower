import { ProductMark } from "@/components/ProductMark";
import type { OverviewCopy } from "@/lib/portfolio/copy";
import styles from "./Tower.module.css";

const MODULES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function FactValue({
  pending,
  value,
  ready,
  marker,
}: {
  pending: string;
  value: React.ReactNode;
  ready: boolean;
  marker?: "tower";
}) {
  return (
    <span className={styles.value}>
      <span className={ready ? styles.quiet : undefined}>{pending}</span>
      {ready ? <span className={styles.figure} data-last-received={marker}>{value}</span> : null}
    </span>
  );
}

export function Tower({
  copy,
  stateWord,
  projects,
  fresh,
  stale,
  last,
  ready,
  flashModules,
}: {
  copy: OverviewCopy;
  stateWord: string;
  projects: string;
  fresh: string;
  stale: string;
  last: React.ReactNode;
  ready: boolean;
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
      <span className={styles.panel} data-tower-panel="">
        <span className={styles.state}>
          <span className={styles.led} />
          {stateWord}
        </span>
        <span className={styles.fact}>
          <span>{copy.projects}</span>
          <FactValue pending={copy.unknown} value={projects} ready={ready} />
        </span>
        <span className={styles.fact}>
          <span>{copy.fresh}</span>
          <FactValue pending={copy.unknown} value={fresh} ready={ready} />
        </span>
        <span className={styles.fact}>
          <span>{copy.staleOrSilent}</span>
          <FactValue pending={copy.unknown} value={stale} ready={ready} />
        </span>
        <span className={`${styles.fact} ${styles.factStack}`}>
          <span>{copy.lastReceived}</span>
          <FactValue pending={copy.unknown} value={last} ready={ready} marker="tower" />
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
