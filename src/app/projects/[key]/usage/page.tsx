import { notFound } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { AgeText } from "@/components/AgeText";
import { Bar } from "@/components/Bar";
import { Bidi } from "@/components/Bidi";
import { Counter } from "@/components/Counter";
import { CoverageLine } from "@/components/CoverageLine";
import { FreshnessLabel } from "@/components/FreshnessLabel";
import { HealthBanner } from "@/components/HealthBanner";
import { StateBlock } from "@/components/StateBlock";
import { UsageTable } from "@/components/UsageTable";
import { getMessages } from "@/i18n/messages";
import { formatCount } from "@/lib/portfolio/formatCount";
import { requireOwner } from "@/lib/supabase/server/session";
import type { UsageCounts, UsageReport } from "@/lib/usage/aggregate";
import type { UsageCopy } from "@/lib/usage/copy";
import { loadUsage } from "@/lib/supabase/server/usage";
import styles from "./page.module.css";

const PROJECT_KEY = /^[A-Z][A-Z0-9_-]{1,31}$/;

function usageCopy(messages: ReturnType<typeof getMessages>): UsageCopy {
  return {
    title: messages.usage.title,
    lead: messages.usage.lead,
    coverage: messages.usage.coverage,
    byAgent: messages.usage.byAgent,
    byModel: messages.usage.byModel,
    attempts: messages.usage.attempts,
    failed: messages.usage.failed,
    noFailed: messages.usage.noFailed,
    empty: messages.usage.empty,
    legend: messages.usage.legend,
    phase: messages.usage.phase,
    task: messages.usage.task,
    run: messages.usage.run,
    agent: messages.usage.agent,
    model: messages.usage.model,
    alias: messages.usage.alias,
    input: messages.usage.input,
    output: messages.usage.output,
    cacheRead: messages.usage.cacheRead,
    cacheWrite: messages.usage.cacheWrite,
    source: messages.usage.source,
    result: messages.usage.result,
    measured: messages.usage.measured,
    unknown: messages.cards.unknown,
    fresh: messages.states.fresh,
    stale: messages.link.stale,
    noContact: messages.states.noContact,
    unavailable: messages.states.unavailable,
    error: messages.state.error,
  };
}

function shown(value: number | null, dash: string): string {
  return value === null ? dash : formatCount(value);
}

function Total({ agent, field, value, dash }: { agent: string; field: keyof UsageCounts; value: number | null; dash: string }) {
  return <dd data-usage-total={`${agent}-${field}`}>{value === null ? dash : <Counter value={value} />}</dd>;
}

function ModelCells({ row, copy }: { row: UsageReport["byModel"][number]; copy: UsageCopy }) {
  return (
    <>
      <td className={styles.cell}>
        <span className={styles.cellLabel}>{copy.agent}</span>
        <span className={styles.mono}>
          <Bidi>{row.agent}</Bidi>
        </span>
      </td>
      <td className={styles.cell}>
        <span className={styles.cellLabel}>{copy.model}</span>
        <span className={styles.mono}>
          <Bidi>{row.model}</Bidi>
        </span>
      </td>
      <td className={`${styles.cell} ${styles.number}`}>
        <span className={styles.cellLabel}>{copy.attempts}</span>
        <span>{formatCount(row.attempts)}</span>
      </td>
      <td className={`${styles.cell} ${styles.number}`}>
        <span className={styles.cellLabel}>{copy.measured}</span>
        <span>{formatCount(row.measured)}</span>
      </td>
      <td className={`${styles.cell} ${styles.number}`}>
        <span className={styles.cellLabel}>{copy.input}</span>
        <span>{shown(row.input, copy.unknown)}</span>
      </td>
      <td className={`${styles.cell} ${styles.number}`}>
        <span className={styles.cellLabel}>{copy.output}</span>
        <span>{shown(row.output, copy.unknown)}</span>
      </td>
      <td className={`${styles.cell} ${styles.number}`}>
        <span className={styles.cellLabel}>{copy.cacheRead}</span>
        <span>{shown(row.cacheRead, copy.unknown)}</span>
      </td>
      <td className={`${styles.cell} ${styles.number}`}>
        <span className={styles.cellLabel}>{copy.cacheWrite}</span>
        <span>{shown(row.cacheWrite, copy.unknown)}</span>
      </td>
    </>
  );
}

function UsageBody({ report, copy }: { report: UsageReport; copy: UsageCopy }) {
  const empty = report.attempts.length + report.failedAttempts.length === 0;
  if (empty) {
    return (
      <>
        <CoverageLine coverage={report.coverage} template={copy.coverage} />
        <StateBlock kind="empty" message={copy.empty} />
      </>
    );
  }

  return (
    <>
      <CoverageLine coverage={report.coverage} template={copy.coverage} />
      <section className={styles.section}>
        <h2>{copy.byAgent}</h2>
        <div className={styles.agents}>
          {report.byAgent.map((row) => {
            const coverage = report.coverage.find((item) => item.agent === row.agent);
            return (
              <article key={row.agent} className={styles.card}>
                <h3 className={styles.agentWord}>{row.agent}</h3>
                <div className={styles.measured}>
                  <Bar passed={coverage?.measured ?? 0} seen={coverage?.ended ?? 0} dash={copy.unknown} />
                  <span className={styles.measuredLabel}>{copy.measured}</span>
                </div>
                <dl className={styles.totals}>
                  <div>
                    <dt>{copy.input}</dt>
                    <Total agent={row.agent} field="input" value={row.input} dash={copy.unknown} />
                  </div>
                  <div>
                    <dt>{copy.output}</dt>
                    <Total agent={row.agent} field="output" value={row.output} dash={copy.unknown} />
                  </div>
                  <div>
                    <dt>{copy.cacheRead}</dt>
                    <Total agent={row.agent} field="cacheRead" value={row.cacheRead} dash={copy.unknown} />
                  </div>
                  <div>
                    <dt>{copy.cacheWrite}</dt>
                    <Total agent={row.agent} field="cacheWrite" value={row.cacheWrite} dash={copy.unknown} />
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>
      <section className={styles.section}>
        <h2>{copy.byModel}</h2>
        <table className={styles.modelTable}>
          <thead>
            <tr className={styles.modelHead}>
              <th scope="col">{copy.agent}</th>
              <th scope="col">{copy.model}</th>
              <th scope="col">{copy.attempts}</th>
              <th scope="col">{copy.measured}</th>
              <th scope="col">{copy.input}</th>
              <th scope="col">{copy.output}</th>
              <th scope="col">{copy.cacheRead}</th>
              <th scope="col">{copy.cacheWrite}</th>
            </tr>
          </thead>
          <tbody>
            {report.byModel.map((row) => (
              <tr key={`${row.agent}-${row.model}`} className={styles.modelRow} data-model-row={`${row.agent}-${row.model}`}>
                <ModelCells row={row} copy={copy} />
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className={styles.section}>
        <h2>{copy.attempts}</h2>
        <UsageTable attempts={report.attempts} copy={copy} />
      </section>
      <section className={styles.section}>
        <h2>{copy.failed}</h2>
        {report.failedAttempts.length > 0 ? (
          <div data-failed-attempts="">
            <UsageTable attempts={report.failedAttempts} copy={copy} />
          </div>
        ) : (
          <p className={styles.none}>{copy.noFailed}</p>
        )}
      </section>
      <p className={styles.legend} data-usage-legend="">
        {copy.legend}
      </p>
    </>
  );
}

export default async function UsagePage({ params }: { params: Promise<{ key: string }> }) {
  const owner = await requireOwner();
  const { key } = await params;
  if (!PROJECT_KEY.test(key)) notFound();
  const report = await loadUsage(key);
  if (report === "not_found") notFound();
  const copy = usageCopy(getMessages());

  return (
    <AppShell login={owner.login} avatarUrl={owner.avatarUrl}>
      <div className={styles.page}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>{key}</p>
          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.lead}>{copy.lead}</p>
          {report === "unavailable" ? null : (
            <p className={styles.meta}>
              <a className={styles.repo} href={`https://github.com/${report.project.repo}`} rel="noreferrer">
                <Bidi>{report.project.repo}</Bidi>
              </a>
              <FreshnessLabel
                freshness={report.freshness}
                fresh={copy.fresh}
                stale={copy.stale}
                none={copy.noContact}
              />
              {report.lastContactAt !== null ? (
                <AgeText at={report.lastContactAt} empty={copy.noContact} />
              ) : null}
            </p>
          )}
        </header>
        {report === "unavailable" ? (
          <>
            <HealthBanner message={copy.unavailable} />
            <StateBlock kind="error" message={copy.error} />
          </>
        ) : (
          <UsageBody report={report} copy={copy} />
        )}
      </div>
    </AppShell>
  );
}
