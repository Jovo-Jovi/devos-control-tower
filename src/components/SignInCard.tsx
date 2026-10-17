import { DocumentLocale } from "./DocumentLocale";
import { SignInButton } from "./SignInButton";
import type { Messages } from "@/i18n/messages";
import styles from "./SignInCard.module.css";

export function SignInCard({
  messages,
  state,
}: {
  messages: Messages;
  state: "signed-out" | "denied" | "error";
}) {
  const errorText = messages.signIn.error.replaceAll("{reason}", messages.signIn.authErrorReason);

  return (
    <main className={styles.page}>
      <DocumentLocale />
      <section className={styles.card}>
        <p className={styles.product}>{messages.site.productName}</p>
        <h1 className={styles.title}>{messages.signIn.title}</h1>
        {state === "signed-out" ? <p className={styles.body}>{messages.signIn.body}</p> : null}
        {state === "denied" ? <p className={styles.body}>{messages.signIn.denied}</p> : null}
        {state === "error" ? <p className={styles.body}>{errorText}</p> : null}
        {state === "signed-out" ? <SignInButton label={messages.signIn.button} /> : null}
        {state === "error" ? (
          <a className={styles.retry} href="/sign-in">
            {messages.signIn.retry}
          </a>
        ) : null}
      </section>
    </main>
  );
}
