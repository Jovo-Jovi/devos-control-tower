import { notFound } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { AgeText } from "@/components/AgeText";
import { Bidi } from "@/components/Bidi";
import { EvidenceLink } from "@/components/EvidenceLink";
import { FreshnessLabel } from "@/components/FreshnessLabel";
import { HealthBanner } from "@/components/HealthBanner";
import { OriginChip } from "@/components/OriginChip";
import { PhaseRail } from "@/components/PhaseRail";
import { StateBlock } from "@/components/StateBlock";
import { Timeline } from "@/components/Timeline";
import { getMessages } from "@/i18n/messages";
import type { ProjectReport } from "@/lib/project/aggregate";
import type { ProjectCopy } from "@/lib/project/copy";
import { loadProject } from "@/lib/supabase/server/project";
import { requireOwner } from "@/lib/supabase/server/session";
import styles from "./page.module.css";

const PROJECT_KEY = /^[A-Z][A-Z0-9_-]{1,31}$/;

function projectCopy(messages: ReturnType<typeof getMessages>): ProjectCopy {
  return {
    eyebrow: messages.project.eyebrow,
    lead: messages.project.lead,
    lastActivity: messages.project.lastActivity,
    lastContact: messages.project.lastContact,
    phases: messages.project.phases,
    runs: messages.project.runs,
    observed: messages.project.observed,
    noObserved: messages.project.noObserved,
    empty: messages.project.empty,
    gap: messages.project.gap,
    running: messages.project.running,
    unfinished: messages.project.unfinished,
    atRange: messages.project.atRange,
    seq: messages.project.seq,
    legend: messages.project.legend,
    usage: messages.detail.usage,
    unknown: messages.cards.unknown,
    ci: messages.cards.ci,
    local: messages.cards.local,
    imported: messages.cards.imported,
    fresh: messages.states.fresh,
    stale: messages.link.stale,
    noContact: messages.states.noContact,
    unavailable: messages.states.unavailable,
    error: messages.state.error,
  };
}

function hasStepEvent(report: ProjectReport): boolean {
  return report.runs.some((run) => run.entries.some((entry) => "seq" in entry));
}

function ProjectBody({ report, copy }: { report: ProjectReport; copy: ProjectCopy }) {
  const empty = !hasStepEvent(report);
  return (
    <>
      {empty ? (
        <StateBlock kind="empty" message={copy.empty} />
      ) : (
        <>
          <section className={styles.section}>
            <h2>{copy.phases}</h2>
            <PhaseRail phases={report.phases} copy={copy} />
          </section>
          <section className={styles.section}>
            <h2>{copy.runs}</h2>
            {report.runs.map((run, index) => (
              <Timeline key={run.runKey} run={run} repo={report.project.repo} copy={copy} enter={index === 0} />
            ))}
          </section>
        </>
      )}
      <section className={styles.section}>
        <h2>{copy.observed}</h2>
        {report.observations.length === 0 ? (
          <p className={styles.none}>{copy.noObserved}</p>
        ) : (
          <ul className={styles.observations}>
            {report.observations.map((observation) => (
              <li key={observation.id} className={styles.observation} data-observation="">
                {observation.context
                  ? `${observation.kind} · ${observation.context} · ${observation.state}`
                  : `${observation.kind} · ${observation.state}`}{" "}
                <EvidenceLink
                  repo={report.project.repo}
                  commit={observation.sha}
                  path={null}
                  text={observation.sha.slice(0, 7)}
                />{" "}
                <OriginChip origin="observed" /> <AgeText at={observation.receivedAt} empty={copy.noContact} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className={styles.legend} data-project-legend="">
        {copy.legend}
      </p>
    </>
  );
}

export default async function ProjectPage({ params }: { params: Promise<{ key: string }> }) {
  const owner = await requireOwner();
  const { key } = await params;
  if (!PROJECT_KEY.test(key)) notFound();
  const report = await loadProject(key);
  if (report === "not_found") notFound();
  const copy = projectCopy(getMessages());

  return (
    <AppShell login={owner.login} avatarUrl={owner.avatarUrl}>
      <div className={styles.page}>
        <header className={styles.head} data-project-head="">
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 className={styles.title}>{key}</h1>
          <p className={styles.lead}>{copy.lead}</p>
          {report === "unavailable" ? null : (
            <p className={styles.meta} data-project-meta="">
              <a className={styles.repo} href={`https://github.com/${report.project.repo}`} rel="noreferrer">
                <Bidi>{report.project.repo}</Bidi>
              </a>
              <FreshnessLabel freshness={report.freshness} fresh={copy.fresh} stale={copy.stale} none={copy.noContact} />
              {report.lastContactAt !== null ? (
                <span className={styles.fact}>
                  <span>{copy.lastContact}</span>
                  <AgeText at={report.lastContactAt} empty={copy.noContact} />
                </span>
              ) : null}
              {report.lastActivityAt !== null ? (
                <span className={styles.fact}>
                  <span>{copy.lastActivity}</span>
                  <AgeText at={report.lastActivityAt} empty={copy.noContact} />
                </span>
              ) : null}
              <a className={styles.usage} href={`/projects/${report.project.key}/usage`}>
                {copy.usage}
              </a>
              <a className={styles.import} href={`/projects/${report.project.key}/import`}>
                {getMessages().project.import}
              </a>
            </p>
          )}
        </header>
        {report === "unavailable" ? (
          <>
            <HealthBanner message={copy.unavailable} />
            <StateBlock kind="error" message={copy.error} />
          </>
        ) : (
          <ProjectBody report={report} copy={copy} />
        )}
      </div>
    </AppShell>
  );
}
