"use client";

import { useActionState } from "react";
import { registerProject, type RegisterState } from "./actions";
import styles from "./RegisterForm.module.css";

function fieldError(kind: "invalid" | "taken" | undefined, invalid: string, taken: string): string | null {
  if (kind === "taken") return taken;
  if (kind === "invalid") return invalid;
  return null;
}

export function RegisterForm({
  keyLabel,
  repoLabel,
  staleLabel,
  submitLabel,
  pendingLabel,
  keyError,
  repoError,
  staleError,
  keyTaken,
  repoTaken,
  failed,
}: {
  keyLabel: string;
  repoLabel: string;
  staleLabel: string;
  submitLabel: string;
  pendingLabel: string;
  keyError: string;
  repoError: string;
  staleError: string;
  keyTaken: string;
  repoTaken: string;
  failed: string;
}) {
  const [state, action, pending] = useActionState<RegisterState | null, FormData>(registerProject, null);
  const keyMessage = fieldError(state?.key, keyError, keyTaken);
  const repoMessage = fieldError(state?.repo, repoError, repoTaken);
  const staleMessage = state?.stale ? staleError : null;
  const values = state?.values;
  const formKey = values ? `${values.key}\u0000${values.repo}\u0000${values.stale}` : "blank";

  return (
    <form className={styles.form} action={action} key={formKey}>
      <div className={styles.field} data-invalid={keyMessage ? "" : undefined}>
        <label htmlFor="register-key">{keyLabel}</label>
        <input
          id="register-key"
          name="key"
          defaultValue={values?.key ?? ""}
          aria-invalid={keyMessage ? true : undefined}
          aria-describedby={keyMessage ? "register-key-error" : undefined}
        />
        <span className={styles.error} id="register-key-error">
          {keyMessage}
        </span>
      </div>
      <div className={styles.field} data-invalid={repoMessage ? "" : undefined}>
        <label htmlFor="register-repo">{repoLabel}</label>
        <input
          id="register-repo"
          name="repo"
          defaultValue={values?.repo ?? ""}
          aria-invalid={repoMessage ? true : undefined}
          aria-describedby={repoMessage ? "register-repo-error" : undefined}
        />
        <span className={styles.error} id="register-repo-error">
          {repoMessage}
        </span>
      </div>
      <div className={styles.field} data-invalid={staleMessage ? "" : undefined}>
        <label htmlFor="register-stale">{staleLabel}</label>
        <input
          id="register-stale"
          name="stale"
          defaultValue={values?.stale ?? "1440"}
          inputMode="numeric"
          aria-invalid={staleMessage ? true : undefined}
          aria-describedby={staleMessage ? "register-stale-error" : undefined}
        />
        <span className={styles.error} id="register-stale-error">
          {staleMessage}
        </span>
      </div>
      <button className={styles.submit} type="submit">
        {pending ? pendingLabel : submitLabel}
      </button>
      {state?.form ? <p className={styles.failed}>{failed}</p> : null}
    </form>
  );
}
