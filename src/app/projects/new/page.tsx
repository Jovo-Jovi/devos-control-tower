import { AppShell } from "@/app/AppShell";
import { getMessages } from "@/i18n/messages";
import { requireOwner } from "@/lib/supabase/server/session";
import { RegisterForm } from "./RegisterForm";
import styles from "./page.module.css";

export default async function RegisterProjectPage() {
  const owner = await requireOwner();
  const messages = getMessages();

  return (
    <AppShell login={owner.login} avatarUrl={owner.avatarUrl}>
      <h1 className={styles.title}>{messages.register.title}</h1>
      <RegisterForm
        keyLabel={messages.register.key}
        repoLabel={messages.register.repo}
        staleLabel={messages.register.stale}
        submitLabel={messages.register.submit}
        pendingLabel={messages.register.pending}
        keyError={messages.register.keyError}
        repoError={messages.register.repoError}
        staleError={messages.register.staleError}
        keyTaken={messages.register.keyTaken}
        repoTaken={messages.register.repoTaken}
        failed={messages.register.failed}
      />
    </AppShell>
  );
}
