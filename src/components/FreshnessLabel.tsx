import styles from "./FreshnessLabel.module.css";

export function FreshnessLabel({
  freshness,
  fresh,
  stale,
  none,
}: {
  freshness: "fresh" | "stale" | "none";
  fresh: string;
  stale: string;
  none: string;
}) {
  const text = freshness === "fresh" ? fresh : freshness === "stale" ? stale : none;
  return (
    <span className={styles.label} data-freshness={freshness}>
      {text}
    </span>
  );
}
