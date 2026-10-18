import { ProductMark } from "./ProductMark";
import { SignInButton } from "./SignInButton";
import type { Messages } from "@/i18n/messages";
import styles from "./SignInCard.module.css";

export function SignInCard({
  messages,
  state,
}: {
  messages: Messages;
  state: "signed-out" | "denied" | "error" | "checking";
}) {
  const errorText = messages.signIn.error.replaceAll("{reason}", messages.signIn.authErrorReason);
  const pendingLabel = messages.signIn.redirecting;

  return (
    <main className={styles.page}>
      <section className={styles.card} data-sign-in-card="" data-state={state}>
        {state === "error" ? <span className={styles.errorLine} data-error-line="" /> : null}
        <div className={`${styles.brand} ${styles.enter} ${styles.enter1}`}>
          <ProductMark shared />
          <span className={styles.word}>{messages.shell.productWord}</span>
        </div>
        <h1 className={`${styles.title} ${styles.enter} ${styles.enter2}`}>{messages.signIn.display}</h1>
        {state === "signed-out" ? (
          <p className={`${styles.body} ${styles.enter} ${styles.enter3}`}>{messages.signIn.body}</p>
        ) : null}
        {state === "signed-out" ? (
          <div className={`${styles.action} ${styles.enter} ${styles.enter4}`}>
            <SignInButton label={messages.signIn.button} pendingLabel={pendingLabel} />
          </div>
        ) : null}
        {state === "denied" ? (
          <div className={`${styles.action} ${styles.enter} ${styles.enter4}`}>
            <SignInButton label={messages.signIn.anotherAccount} pendingLabel={pendingLabel} />
          </div>
        ) : null}
        {state === "denied" ? (
          <p className={`${styles.body} ${styles.enter} ${styles.enter3} ${styles.reveal}`}>{messages.signIn.denied}</p>
        ) : null}
        {state === "error" ? (
          <p className={`${styles.body} ${styles.enter} ${styles.enter3} ${styles.reveal}`}>{errorText}</p>
        ) : null}
        {state === "error" ? (
          <div className={`${styles.action} ${styles.enter} ${styles.enter4}`}>
            <SignInButton label={messages.signIn.retry} pendingLabel={pendingLabel} />
          </div>
        ) : null}
        {state === "checking" ? (
          <p className={`${styles.body} ${styles.enter} ${styles.enter3}`} role="status">
            {messages.signIn.checking}
          </p>
        ) : null}
        {state === "checking" ? (
          <span className={`${styles.checkingLine} ${styles.enter} ${styles.enter4}`} data-checking-line="">
            <span className={styles.segment} />
          </span>
        ) : null}
      </section>
    </main>
  );
}
