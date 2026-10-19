"use client";

import { useActionState, useRef, useState } from "react";
import { ImportResult } from "@/components/ImportResult";
import { formatCount } from "@/lib/portfolio/formatCount";
import type { HistoryRefusal } from "@/lib/history/parse";
import { importHistory, type ImportState } from "./actions";
import styles from "./ImportForm.module.css";

const MAX_FILE_BYTES = 512000;

export type ImportCopy = {
  file: string;
  drop: string;
  submit: string;
  pending: string;
  stored: string;
  duplicate: string;
  conflict: string;
  run: string;
  view: string;
  invalid: string;
  empty: string;
  tooLarge: string;
  failed: string;
  reasonJson: string;
  reasonContract: string;
  reasonProject: string;
  reasonRun: string;
  reasonSeq: string;
  reasonTooMany: string;
  unavailable: string;
  notFound: string;
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? "");
}

function reasonWord(reason: HistoryRefusal, copy: ImportCopy): string | null {
  switch (reason) {
    case "json":
      return copy.reasonJson;
    case "contract":
      return copy.reasonContract;
    case "project":
      return copy.reasonProject;
    case "run":
      return copy.reasonRun;
    case "seq":
      return copy.reasonSeq;
    case "too_many":
      return copy.reasonTooMany;
    case "empty":
      return null;
  }
}

function errorText(state: ImportState | null, oversized: boolean, copy: ImportCopy): string | null {
  if (oversized) return copy.tooLarge;
  if (!state || state.kind === "done") return null;
  if (state.kind === "empty") return copy.empty;
  if (state.kind === "too_large") return copy.tooLarge;
  if (state.kind === "error") return state.reason === "unavailable" ? copy.unavailable : copy.notFound;
  if (state.kind === "failed") {
    return fill(copy.failed, { line: formatCount(state.line), stored: formatCount(state.stored) });
  }
  if (state.reason === "empty") return copy.empty;
  const reason = reasonWord(state.reason, copy);
  if (!reason) return copy.empty;
  return fill(copy.invalid, { line: formatCount(state.line), reason });
}

function selectedFile(input: HTMLInputElement | null): File | null {
  return input?.files?.[0] ?? null;
}

function overLimit(file: File | null): boolean {
  return file !== null && file.size > MAX_FILE_BYTES;
}

export function ImportForm({ projectKey, copy }: { projectKey: string; copy: ImportCopy }) {
  const [state, formAction, pending] = useActionState(importHistory.bind(null, projectKey), null);
  const [drag, setDrag] = useState(false);
  const [oversized, setOversized] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const message = pending ? null : errorText(state, oversized, copy);
  const mode = pending ? "uploading" : message ? "error" : state?.kind === "done" ? "result" : "idle";

  function noteFile(file: File | null) {
    setOversized(overLimit(file));
  }

  function onDragEnter(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDrag(true);
  }

  function onDragOver(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDrag(true);
  }

  function onDragLeave(event: React.DragEvent<HTMLLabelElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setDrag(false);
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDrag(false);
    const input = fileRef.current;
    const files = event.dataTransfer.files;
    if (!input || files.length === 0) return;
    try {
      input.files = files;
    } catch {
      const transfer = new DataTransfer();
      const first = files[0];
      if (!first) return;
      transfer.items.add(first);
      input.files = transfer.files;
    }
    noteFile(selectedFile(input));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (overLimit(selectedFile(fileRef.current))) {
      event.preventDefault();
      setOversized(true);
    }
  }

  return (
    <>
      <form
        className={styles.form}
        action={formAction}
        data-import-form=""
        data-import-state={mode}
        encType="multipart/form-data"
        onSubmit={onSubmit}
      >
        <label
          className={styles.zone}
          data-drop-zone=""
          data-drag={drag ? "" : undefined}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <span className={styles.fileLabel}>{copy.file}</span>
          <span className={styles.drop}>{copy.drop}</span>
          <input
            ref={fileRef}
            className={styles.file}
            type="file"
            name="history"
            accept=".jsonl,application/x-ndjson"
            required
            onChange={(event) => noteFile(selectedFile(event.currentTarget))}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? "import-error" : undefined}
          />
        </label>
        <button className={styles.submit} type="submit" disabled={pending} aria-busy={pending ? true : undefined}>
          {copy.submit}
        </button>
        {pending ? (
          <p className={styles.status} role="status">
            {copy.pending}
            <span className={styles.track} data-upload-line="">
              <span className={styles.segment} />
            </span>
          </p>
        ) : null}
      </form>
      {mode === "result" && state?.kind === "done" ? (
        <ImportResult
          projectKey={projectKey}
          run={state.run}
          stored={state.stored}
          duplicate={state.duplicate}
          conflict={state.conflict}
          runTemplate={copy.run}
          storedLabel={copy.stored}
          duplicateLabel={copy.duplicate}
          conflictLabel={copy.conflict}
          viewLabel={copy.view}
        />
      ) : null}
      {message ? (
        <p className={styles.alert} id="import-error" data-import-error="" role="alert">
          {message}
        </p>
      ) : null}
    </>
  );
}
