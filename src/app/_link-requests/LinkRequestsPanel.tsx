"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { AgeText } from "@/components/AgeText";
import { Bidi } from "@/components/Bidi";
import { StateBlock } from "@/components/StateBlock";
import { Toast } from "@/components/Toast";
import type { Messages } from "@/i18n/messages";
import { groupLinkRequests, type LinkRequestView } from "@/lib/link-requests/groups";
import { fill } from "@/lib/portfolio/copy";
import { formatCount } from "@/lib/portfolio/formatCount";
import {
  approveLinkRequestAction,
  declineLinkRequestAction,
  deleteLinkRequestAction,
  exportLinkRequestAction,
} from "./actions";
import styles from "./LinkRequestsPanel.module.css";

type LinkRequestCopy = Messages["linkRequests"];
type RowAction = "approve" | "decline" | "export" | "delete";
type LinkOutcome = Awaited<ReturnType<typeof approveLinkRequestAction>>;

const CALLS = {
  approve: approveLinkRequestAction,
  decline: declineLinkRequestAction,
  export: exportLinkRequestAction,
  delete: deleteLinkRequestAction,
} as const;

const ROW_ACTIONS: Record<LinkRequestView["state"], readonly RowAction[]> = {
  pending: ["approve", "decline", "export", "delete"],
  approved: ["decline", "export", "delete"],
  declined: ["export", "delete"],
};

function downloadDocument(body: unknown, proposedKey: string) {
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `link-request-${proposedKey}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function frameworkSignal(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  return typeof error.digest === "string" && error.digest.startsWith("NEXT_");
}

function isolateKey(filled: string, key: string) {
  const at = key ? filled.indexOf(key) : -1;
  if (at < 0) return filled;
  return (
    <>
      {filled.slice(0, at)}
      <Bidi>{key}</Bidi>
      {filled.slice(at + key.length)}
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function RequestGroup({
  name,
  label,
  rows,
  copy,
  noticeFor,
  onNotice,
  onToast,
}: {
  name: "pending" | "linked" | "declined";
  label: string;
  rows: readonly LinkRequestView[];
  copy: LinkRequestCopy;
  noticeFor: (id: string) => string | null;
  onNotice: (id: string, text: string | null) => void;
  onToast: (text: string) => void;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.group} data-group={name}>
      <h3 className={styles.groupTitle} id={headingId}>
        <span>{label}</span> <span className={styles.count}>{formatCount(rows.length)}</span>
      </h3>
      {rows.length === 0 ? (
        <p className={styles.none}>{copy.none}</p>
      ) : (
        rows.map((row) => (
          <RequestRow
            key={row.id}
            copy={copy}
            notice={noticeFor(row.id)}
            onNotice={onNotice}
            onToast={onToast}
            row={row}
          />
        ))
      )}
    </section>
  );
}

function RequestRow({
  row,
  copy,
  notice,
  onNotice,
  onToast,
}: {
  row: LinkRequestView;
  copy: LinkRequestCopy;
  notice: string | null;
  onNotice: (id: string, text: string | null) => void;
  onToast: (text: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [pressed, setPressed] = useState<RowAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreDeleteFocus = useRef(false);
  const lock = useRef(false);
  const confirmId = useId();
  const locked = pressed !== null || pending;

  useEffect(() => {
    if (!confirming) {
      if (!restoreDeleteFocus.current) return;
      restoreDeleteFocus.current = false;
      deleteRef.current?.focus();
      return;
    }
    cancelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || lock.current) return;
      event.preventDefault();
      restoreDeleteFocus.current = true;
      setConfirming(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  function report(outcome: LinkOutcome, stateAtClick: LinkRequestView["state"]) {
    switch (outcome.kind) {
      case "approved":
        onNotice(row.id, null);
        onToast(fill(copy.approved, { key: outcome.key }));
        return;
      case "declined":
        onNotice(row.id, null);
        onToast(stateAtClick === "approved" ? copy.disconnectedDone : copy.declinedDone);
        return;
      case "deleted":
        onNotice(row.id, null);
        onToast(copy.deleted);
        return;
      case "exported":
        onNotice(row.id, null);
        onToast(copy.exported);
        return;
      case "repo_taken":
        onNotice(row.id, copy.repoTaken);
        return;
      case "not_pending":
        onNotice(row.id, copy.notPending);
        return;
      case "not_found":
        onNotice(row.id, copy.notFound);
        return;
      case "failed":
        onNotice(row.id, copy.failed);
        return;
      default: {
        const unreachable: never = outcome;
        onNotice(row.id, copy.failed);
        return unreachable;
      }
    }
  }

  function finish(outcome: LinkOutcome, stateAtClick: LinkRequestView["state"]) {
    report(outcome, stateAtClick);
    setPressed(null);
    lock.current = false;
    if (outcome.kind === "deleted") {
      restoreDeleteFocus.current = false;
      setConfirming(false);
    }
  }

  function run(action: RowAction) {
    if (lock.current) return;
    lock.current = true;
    const stateAtClick = row.state;
    const proposedKey = row.proposedKey;
    const id = row.id;
    setPressed(action);
    onNotice(id, null);
    startTransition(async () => {
      let outcome: LinkOutcome;
      try {
        outcome = await CALLS[action](id);
      } catch (error) {
        if (frameworkSignal(error)) throw error;
        startTransition(() => {
          onNotice(id, copy.failed);
          setPressed(null);
          lock.current = false;
        });
        return;
      }
      if (outcome.kind === "exported") downloadDocument(outcome.document, proposedKey);
      startTransition(() => finish(outcome, stateAtClick));
    });
  }

  function askDelete() {
    if (lock.current) return;
    setConfirming(true);
  }

  function closeConfirm() {
    if (lock.current) return;
    restoreDeleteFocus.current = true;
    setConfirming(false);
  }

  return (
    <article
      aria-busy={locked ? true : undefined}
      className={styles.row}
      data-link-request={row.id}
      data-request-state={row.state}
    >
      <dl className={styles.fields}>
        <Fact label={copy.repository}>
          <Bidi>{row.repository}</Bidi>
        </Fact>
        <Fact label={copy.ownerId}>{row.ownerGithubId}</Fact>
        {row.state === "pending" ? (
          <Fact label={copy.proposedKey}>
            <Bidi>{row.proposedKey}</Bidi>
          </Fact>
        ) : row.projectKey !== null ? (
          <Fact label={copy.project}>
            <span className={styles.projectValue}>
              <Bidi>{row.projectKey}</Bidi>
              {row.state === "declined" ? <span className={styles.flag}>{copy.disconnected}</span> : null}
            </span>
          </Fact>
        ) : null}
        <Fact label={copy.engine}>{row.engineVersion}</Fact>
        <Fact label={copy.contract}>{row.contractVersion}</Fact>
        <Fact label={copy.firstRequest}>
          <AgeText at={row.firstRequestedAt} empty={copy.none} />
        </Fact>
        <Fact label={copy.lastRequest}>
          <AgeText at={row.lastRequestedAt} empty={copy.none} />
        </Fact>
        {row.state === "pending" ? null : (
          <Fact label={copy.decided}>
            <AgeText at={row.decidedAt} empty={copy.none} />
          </Fact>
        )}
      </dl>
      {notice ? (
        <p className={styles.rowNotice} data-row-message="" role="status">
          {notice}
        </p>
      ) : null}
      {confirming ? (
        <div className={styles.confirm}>
          <p className={styles.confirmCopy} id={confirmId}>
            {row.projectKey !== null
              ? isolateKey(fill(copy.deleteProject, { key: row.projectKey }), row.projectKey)
              : copy.deleteRequest}
          </p>
          <div className={styles.actions}>
            <button
              ref={cancelRef}
              aria-describedby={confirmId}
              className={styles.action}
              data-action="cancel"
              disabled={locked}
              type="button"
              onClick={closeConfirm}
            >
              {copy.cancel}
            </button>
            <button
              aria-describedby={confirmId}
              className={styles.action}
              data-action="confirm"
              disabled={locked}
              type="button"
              onClick={() => run("delete")}
            >
              {pressed === "delete" ? copy.working : copy.confirmDelete}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          {ROW_ACTIONS[row.state].map((action) => (
            <button
              key={action}
              ref={action === "delete" ? deleteRef : undefined}
              className={styles.action}
              data-action={action}
              disabled={locked}
              type="button"
              onClick={action === "delete" ? askDelete : () => run(action)}
            >
              {pressed === action ? copy.working : copy[action]}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

export function LinkRequestsPanel({
  copy,
  requests,
}: {
  copy: LinkRequestCopy;
  requests: LinkRequestView[] | null;
}) {
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  const toastKey = useRef(0);
  const [notices, setNotices] = useState<Record<string, string>>({});
  const grouped = requests === null || requests.length === 0 ? null : groupLinkRequests(requests);
  const mode = requests === null ? "unavailable" : grouped === null ? "empty" : "ready";

  function showToast(text: string) {
    toastKey.current += 1;
    setToast({ key: toastKey.current, text });
  }

  function setNotice(id: string, text: string | null) {
    setNotices((current) => {
      if (text === null) {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      }
      if (current[id] === text) return current;
      return { ...current, [id]: text };
    });
  }

  return (
    <section
      aria-labelledby="link-requests-title"
      className={styles.panel}
      data-link-requests=""
      data-state={mode}
    >
      <h2 className={styles.title} id="link-requests-title">
        {copy.title}
      </h2>
      <p className={styles.lead}>{copy.lead}</p>
      {mode === "unavailable" ? <StateBlock kind="error" message={copy.unavailable} /> : null}
      {mode === "empty" ? <StateBlock kind="empty" message={copy.empty} /> : null}
      {grouped ? (
        <div className={styles.groups}>
          <RequestGroup
            copy={copy}
            label={copy.pending}
            name="pending"
            noticeFor={(id) => notices[id] ?? null}
            onNotice={setNotice}
            onToast={showToast}
            rows={grouped.pending}
          />
          <RequestGroup
            copy={copy}
            label={copy.linked}
            name="linked"
            noticeFor={(id) => notices[id] ?? null}
            onNotice={setNotice}
            onToast={showToast}
            rows={grouped.linked}
          />
          <RequestGroup
            copy={copy}
            label={copy.declined}
            name="declined"
            noticeFor={(id) => notices[id] ?? null}
            onNotice={setNotice}
            onToast={showToast}
            rows={grouped.declined}
          />
        </div>
      ) : null}
      {toast ? <Toast key={toast.key} message={toast.text} /> : null}
    </section>
  );
}
