import { AppShell } from "./AppShell";
import { getMessages } from "@/i18n/messages";
import { requireOwner } from "@/lib/supabase/server/session";
import styles from "./page.module.css";

export default async function HomePage() {
  const owner = await requireOwner();
  const messages = getMessages();

  return (
    <AppShell login={owner.login} avatarUrl={owner.avatarUrl}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{messages.overview.eyebrow}</p>
        <h1 className={styles.title}>{messages.overview.title}</h1>
        <p className={styles.lead}>{messages.overview.lead}</p>
      </div>
    </AppShell>
  );
}
