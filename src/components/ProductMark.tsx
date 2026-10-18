import styles from "./ProductMark.module.css";

export function ProductMark({ shared = false }: { shared?: boolean }) {
  const className = shared ? `${styles.mark} ${styles.shared}` : styles.mark;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 4 L20 12 L6 20 Z"
        fill="none"
        strokeWidth="3"
        strokeLinejoin="round"
        className={styles.wash}
      />
      <path
        d="M6 4 L20 12 L6 20 Z"
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className={styles.edge}
      />
    </svg>
  );
}
