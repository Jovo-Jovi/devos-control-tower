import styles from "./OriginChip.module.css";

export function OriginChip({ origin }: { origin: string }) {
  return (
    <span className={styles.origin} data-origin={origin}>
      {origin}
    </span>
  );
}
