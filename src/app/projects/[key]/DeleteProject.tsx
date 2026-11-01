"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { Bidi } from "@/components/Bidi";
import type { Messages } from "@/i18n/messages";
import { deleteProjectAction, type DeleteProjectState } from "./actions";
import styles from "./DeleteProject.module.css";

type DeleteCopy = Pick<
  Messages["project"],
  | "deleteTitle"
  | "deleteLead"
  | "deleteOpen"
  | "deletePrompt"
  | "deleteKeyLabel"
  | "deleteConfirm"
  | "deleteCancel"
  | "deleteWorking"
  | "deleteMismatch"
  | "deleteLinked"
  | "deleteNotFound"
  | "deleteFailed"
>;

const MESSAGE: Record<NonNullable<DeleteProjectState["error"]>, keyof DeleteCopy> = {
  mismatch: "deleteMismatch",
  linked: "deleteLinked",
  not_found: "deleteNotFound",
  failed: "deleteFailed",
};

function withKey(template: string, projectKey: string) {
  const token = "{key}";
  const at = template.indexOf(token);
  if (at < 0) return template;
  return (
    <>
      {template.slice(0, at)}
      <span className={styles.key}>
        <Bidi>{projectKey}</Bidi>
      </span>
      {template.slice(at + token.length)}
    </>
  );
}

function StableLabel({ current, other }: { current: string; other: string }) {
  return (
    <span className={styles.label}>
      <span>{current}</span>
      <span aria-hidden="true" className={styles.sizer}>
        {other}
      </span>
    </span>
  );
}

function DeleteProjectForm({
  projectKey,
  copy,
  onClose,
}: {
  projectKey: string;
  copy: DeleteCopy;
  onClose: () => void;
}) {
  const fieldRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const messageId = useId();
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState<DeleteProjectState | null, FormData>(deleteProjectAction, null);
  const message = state?.error ? copy[MESSAGE[state.error]] : null;

  useEffect(() => {
    fieldRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || pending) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  function close() {
    if (pending) return;
    onClose();
  }

  return (
    <form
      action={action}
      aria-busy={pending ? true : undefined}
      className={styles.form}
      data-delete-project-confirm=""
    >
      <p className={styles.prompt}>{withKey(copy.deletePrompt, projectKey)}</p>
      <input name="key" type="hidden" value={projectKey} readOnly />
      <div className={styles.field}>
        <label htmlFor={fieldId}>{copy.deleteKeyLabel}</label>
        <input
          ref={fieldRef}
          id={fieldId}
          name="confirmation"
          type="text"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          value={confirmation}
          aria-invalid={state?.error === "mismatch" ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>
      <div className={styles.actions}>
        <button className={styles.action} data-action="delete-cancel" disabled={pending} type="button" onClick={close}>
          {copy.deleteCancel}
        </button>
        <button
          className={styles.confirm}
          data-action="delete-confirm"
          disabled={pending || confirmation !== projectKey}
          type="submit"
        >
          <StableLabel
            current={pending ? copy.deleteWorking : copy.deleteConfirm}
            other={pending ? copy.deleteConfirm : copy.deleteWorking}
          />
        </button>
      </div>
      <p className={styles.message} data-delete-message="" id={messageId} role="status">
        {message ?? "\u00a0"}
      </p>
    </form>
  );
}

export function DeleteProject({ projectKey, copy }: { projectKey: string; copy: DeleteCopy }) {
  const headingId = useId();
  const openRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [opened, setOpened] = useState(0);
  const [visible, setVisible] = useState(false);

  const closeForm = useCallback(() => {
    restoreFocus.current = true;
    setVisible(false);
  }, []);

  useEffect(() => {
    if (visible) return;
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    openRef.current?.focus();
  }, [visible]);

  function openForm() {
    setOpened((count) => count + 1);
    setVisible(true);
  }

  return (
    <section aria-labelledby={headingId} className={styles.section} data-delete-project="">
      <h2 id={headingId}>{copy.deleteTitle}</h2>
      <p className={styles.lead}>{withKey(copy.deleteLead, projectKey)}</p>
      {visible ? (
        <DeleteProjectForm key={opened} copy={copy} projectKey={projectKey} onClose={closeForm} />
      ) : (
        <button ref={openRef} className={styles.action} data-action="delete-open" type="button" onClick={openForm}>
          {copy.deleteOpen}
        </button>
      )}
    </section>
  );
}
