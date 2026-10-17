import Link from "next/link";
import { getMessages } from "@/i18n/messages";
import styles from "./not-found.module.css";

export default function NotFound() {
  const messages = getMessages();

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{messages.notFound.title}</h1>
        <p className={styles.body}>{messages.notFound.body}</p>
        <Link className={styles.back} href="/">
          {messages.notFound.back}
        </Link>
      </div>
    </div>
  );
}
