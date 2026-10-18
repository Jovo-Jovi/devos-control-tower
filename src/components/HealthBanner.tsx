import styles from "./HealthBanner.module.css";

export function HealthBanner({ message }: { message: string }) {
  return (
    <p className={styles.banner} role="alert">
      {message}
    </p>
  );
}
