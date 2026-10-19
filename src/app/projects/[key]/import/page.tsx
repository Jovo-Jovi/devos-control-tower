import { notFound } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { Bidi } from "@/components/Bidi";
import { HealthBanner } from "@/components/HealthBanner";
import { StateBlock } from "@/components/StateBlock";
import { getMessages } from "@/i18n/messages";
import { loadImportTarget } from "@/lib/supabase/server/import";
import { requireOwner } from "@/lib/supabase/server/session";
import { ImportForm } from "./ImportForm";
import styles from "./page.module.css";

const PROJECT_KEY = /^[A-Z][A-Z0-9_-]{1,31}$/;

export default async function ImportPage({ params }: { params: Promise<{ key: string }> }) {
  const owner = await requireOwner();
  const { key } = await params;
  if (!PROJECT_KEY.test(key)) notFound();
  const target = await loadImportTarget(key);
  if (target === "not_found") notFound();
  const messages = getMessages();

  return (
    <AppShell login={owner.login} avatarUrl={owner.avatarUrl}>
      <div className={styles.page}>
        <header className={styles.head} data-import-head="">
          <p className={styles.eyebrow}>{messages.import.eyebrow}</p>
          <h1 className={styles.title}>{messages.import.title}</h1>
          <p className={styles.lead}>{messages.import.lead}</p>
          {target === "unavailable" ? null : (
            <p className={styles.meta}>
              <a className={styles.repo} href={`https://github.com/${target.repo}`} rel="noreferrer">
                <Bidi>{target.repo}</Bidi>
              </a>
              <a className={styles.back} href={`/projects/${target.key}`}>
                {messages.import.back}
              </a>
            </p>
          )}
        </header>
        {target === "unavailable" ? (
          <>
            <HealthBanner message={messages.states.unavailable} />
            <StateBlock kind="error" message={messages.state.error} />
          </>
        ) : (
          <ImportForm
            projectKey={target.key}
            copy={{
              file: messages.import.file,
              drop: messages.import.drop,
              submit: messages.import.submit,
              pending: messages.import.pending,
              stored: messages.import.stored,
              duplicate: messages.import.duplicate,
              conflict: messages.import.conflict,
              run: messages.import.run,
              view: messages.import.view,
              invalid: messages.import.invalid,
              empty: messages.import.empty,
              tooLarge: messages.import.tooLarge,
              failed: messages.import.failed,
              reasonJson: messages.import.reasonJson,
              reasonContract: messages.import.reasonContract,
              reasonProject: messages.import.reasonProject,
              reasonRun: messages.import.reasonRun,
              reasonSeq: messages.import.reasonSeq,
              reasonTooMany: messages.import.reasonTooMany,
              unavailable: messages.states.unavailable,
              notFound: messages.state.error,
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
