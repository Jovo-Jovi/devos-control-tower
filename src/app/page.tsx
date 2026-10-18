import { AppShell } from "./AppShell";
import { Overview } from "./Overview";
import { getMessages } from "@/i18n/messages";
import type { OverviewCopy } from "@/lib/portfolio/copy";
import { requireOwner } from "@/lib/supabase/server/session";
import styles from "./page.module.css";

function overviewCopy(messages: ReturnType<typeof getMessages>): OverviewCopy {
  return {
    loading: messages.state.loading,
    error: messages.state.error,
    register: messages.shell.register,
    productWord: messages.shell.productWord,
    towerTitle: messages.shell.title,
    live: messages.live.live,
    offline: messages.live.offline,
    projects: messages.counts.projects,
    fresh: messages.counts.fresh,
    staleOrSilent: messages.counts.staleOrSilent,
    lastReceived: messages.counts.lastReceived,
    towerState: messages.counts.towerState,
    view: messages.views.label,
    map: messages.views.map,
    list: messages.views.list,
    filter: messages.views.filter,
    all: messages.views.all,
    active: messages.views.active,
    waiting: messages.views.waiting,
    gate: messages.views.gate,
    failed: messages.views.failed,
    tasks: messages.cards.tasks,
    phase: messages.cards.phase,
    ofSeen: messages.cards.ofSeen,
    unknown: messages.cards.unknown,
    more: messages.cards.more,
    ci: messages.cards.ci,
    local: messages.cards.local,
    imported: messages.cards.imported,
    cardLabel: messages.cards.label,
    link: messages.link,
    close: messages.detail.close,
    execution: messages.detail.execution,
    latest: messages.detail.latest,
    fact: messages.detail.fact,
    recent: messages.detail.recent,
    repository: messages.detail.repository,
    project: messages.detail.project,
    usage: messages.detail.usage,
    offlineKnown: messages.map.offline,
    legend: messages.map.legend,
    system: messages.panels.system,
    ofTasks: messages.panels.ofTasks,
    activity: messages.panels.activity,
    health: messages.panels.health,
    hour: messages.panels.hour,
    deliveries: messages.panels.deliveries,
    rejections: messages.panels.rejections,
    empty: messages.states.empty,
    unavailable: messages.states.unavailable,
    registered: messages.states.registered,
    freshWord: messages.states.fresh,
    noContact: messages.states.noContact,
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string | string[] }>;
}) {
  const owner = await requireOwner();
  const messages = getMessages();
  const params = await searchParams;
  const registered = Array.isArray(params.registered) ? params.registered[0] : params.registered;

  return (
    <AppShell login={owner.login} avatarUrl={owner.avatarUrl}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{messages.overview.eyebrow}</p>
        <h1 className={styles.title}>{messages.overview.title}</h1>
        <p className={styles.lead}>{messages.overview.lead}</p>
      </div>
      <Overview copy={overviewCopy(messages)} registeredKey={registered ?? null} />
    </AppShell>
  );
}
