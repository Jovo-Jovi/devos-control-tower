import styles from "./StateBlock.module.css";

export function StateBlock({ kind, message }: { kind: "loading" | "empty" | "error"; message: string }) {
  if (kind === "loading") {
    return (
      <div className={styles.block} aria-busy="true" aria-label={message}>
        <span className={styles.skeleton} />
        <span className={styles.skeleton} />
        <span className={styles.skeleton} />
      </div>
    );
  }
  return (
    <div className={styles.block} data-kind={kind}>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
