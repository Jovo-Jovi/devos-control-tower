"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { AgeText } from "@/components/AgeText";
import { Counter } from "@/components/Counter";
import { HealthBanner } from "@/components/HealthBanner";
import { LiveMark } from "@/components/LiveMark";
import { StateBlock } from "@/components/StateBlock";
import { Toast } from "@/components/Toast";
import { useSetPollStatus } from "@/components/PollStatus";
import { BladeField, type BladeSignal } from "@/components/map/BladeField";
import { DetailPanel } from "@/components/map/DetailPanel";
import { slotGeometry } from "@/components/map/geometry";
import { Panels } from "@/components/map/Panels";
import { ProjectCard } from "@/components/map/ProjectCard";
import { Tower } from "@/components/map/Tower";
import type { LinkState, Portfolio, PortfolioProject } from "@/lib/portfolio/aggregate";
import { fill, type OverviewCopy } from "@/lib/portfolio/copy";
import { tokenMs } from "@/lib/portfolio/readToken";
import styles from "./Overview.module.css";

type Phase = "loading" | "ready" | "error" | "offline" | "offline-first";
type View = "map" | "list";
type Filter = "all" | "active" | "waiting" | "gate" | "failed" | "stale";

const FILTERS: Filter[] = ["all", "active", "waiting", "gate", "failed", "stale"];
const SKELETON_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function matches(filter: Filter, state: LinkState): boolean {
  if (filter === "all") return true;
  if (filter === "active") return state === "active" || state === "steady" || state === "revise";
  if (filter === "waiting") return state === "waiting";
  if (filter === "gate") return state === "gate";
  if (filter === "failed") return state === "down";
  return state === "stale" || state === "silent";
}

function signature(project: PortfolioProject): string {
  const latest = project.latest;
  if (!latest) return "";
  return `${latest.receivedAt}|${latest.seq}|${latest.step}|${latest.status}`;
}

function shownProjects(projects: readonly PortfolioProject[]): PortfolioProject[] {
  return projects.length > 8 ? projects.slice(0, 7) : projects.slice(0, 8);
}

export function Overview({ copy, registeredKey }: { copy: OverviewCopy; registeredKey: string | null }) {
  const reduced = useReducedMotion();
  const setPoll = useSetPollStatus();
  const [phase, setPhase] = useState<Phase>("loading");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [view, setView] = useState<View>("map");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<Record<string, number>>({});
  const [tint, setTint] = useState<Record<string, boolean>>({});
  const [signals, setSignals] = useState<BladeSignal[]>([]);
  const [flashModules, setFlashModules] = useState<number[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const known = useRef(false);
  const previous = useRef<Map<string, string> | null>(null);
  const selectedId = useRef<string | null>(null);
  const pendingFocus = useRef<string | null>(null);

  const close = useCallback(() => {
    pendingFocus.current = selectedId.current;
    setSelected(null);
  }, []);

  useEffect(() => {
    if (selected) return;
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    document.getElementById(id)?.focus();
  }, [selected]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    function fail(status: number) {
      setPoll("offline");
      if (known.current) setPhase("offline");
      else setPhase(status === 503 ? "error" : "offline-first");
    }

    function accept(next: Portfolio) {
      const prior = previous.current;
      const current = new Map(next.projects.map((project) => [project.key, signature(project)]));
      previous.current = current;
      if (prior) {
        const changed = next.projects.filter((project) => prior.has(project.key) && prior.get(project.key) !== signature(project));
        changed.sort(
          (left, right) => Date.parse(left.latest?.receivedAt ?? "") - Date.parse(right.latest?.receivedAt ?? ""),
        );
        setFlashes((existing) => {
          const updated = { ...existing };
          for (const project of changed) updated[project.key] = (updated[project.key] ?? 0) + 1;
          return updated;
        });
        const shown = shownProjects(next.projects);
        if (reduced === false) {
          const signaled = changed
            .map((project) => shown.findIndex((item) => item.key === project.key))
            .filter((slot) => slot >= 0)
            .slice(0, 3);
          setSignals(signaled.map((slot, order) => ({ slot, order })));
          setFlashModules(signaled.map((slot) => slotGeometry(slot).module));
          setTint({});
        } else {
          setSignals([]);
          setFlashModules([]);
          const nextTint: Record<string, boolean> = {};
          for (const project of changed) nextTint[project.key] = true;
          setTint(nextTint);
          window.setTimeout(() => setTint({}), tokenMs("--dur-quick"));
        }
      }
      known.current = true;
      setPortfolio(next);
      setPoll("live");
      setPhase("ready");
      setNow(Date.now());
    }

    async function load() {
      try {
        const response = await fetch("/api/projects", { signal: controller.signal, cache: "no-store" });
        if (!active) return;
        if (response.status === 200) {
          accept((await response.json()) as Portfolio);
          return;
        }
        fail(response.status);
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        fail(0);
      }
    }

    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(id);
    };
  }, [reduced, setPoll]);

  const projects = portfolio?.projects ?? [];
  const figures = phase === "ready" || phase === "offline";
  const shown = shownProjects(projects);
  const overflow = projects.length > 8 ? projects.length - 7 : 0;
  const selectedProject = projects.find((project) => project.key === selected) ?? null;
  const toast =
    figures && registeredKey && projects.some((project) => project.key === registeredKey)
      ? fill(copy.registered, { key: registeredKey })
      : null;

  function dimmed(project: PortfolioProject): "filter" | "panel" | undefined {
    if (!matches(filter, project.linkState)) return "filter";
    if (selected && selected !== project.key) return "panel";
    return undefined;
  }

  function select(key: string, placement: "map" | "list") {
    selectedId.current = `${placement}-card-${key}`;
    setSelected(key);
  }

  const filterLabel: Record<Filter, string> = {
    all: copy.all,
    active: copy.active,
    waiting: copy.waiting,
    gate: copy.gate,
    failed: copy.failed,
    stale: copy.staleOrSilent,
  };

  const towerLast =
    figures && portfolio ? <AgeText at={portfolio.health.lastReceivedAt} empty={copy.noContact} /> : copy.unknown;

  return (
    <div className={styles.root} data-view={view}>
      <section className={styles.counts} aria-label={copy.projects}>
        <dl className={styles.fact}>
          <dt>{copy.projects}</dt>
          <dd>{figures && portfolio ? <Counter value={portfolio.totals.projects} /> : copy.unknown}</dd>
        </dl>
        <dl className={styles.fact}>
          <dt>{copy.fresh}</dt>
          <dd>{figures && portfolio ? <Counter value={portfolio.totals.fresh} /> : copy.unknown}</dd>
        </dl>
        <dl className={styles.fact}>
          <dt>{copy.staleOrSilent}</dt>
          <dd>{figures && portfolio ? <Counter value={portfolio.totals.staleOrSilent} /> : copy.unknown}</dd>
        </dl>
        <dl className={styles.fact}>
          <dt>{copy.lastReceived}</dt>
          <dd>{towerLast}</dd>
        </dl>
      </section>

      <div className={styles.controls}>
        <div className={styles.group} role="group" aria-label={copy.filter}>
          {FILTERS.map((item) => (
            <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>
              {filterLabel[item]}{" "}
              <span className={styles.count}>
                {figures ? projects.filter((project) => matches(item, project.linkState)).length : copy.unknown}
              </span>
            </button>
          ))}
        </div>
        <div className={styles.group} role="group" aria-label={copy.view}>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>
            {copy.map}
          </button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
            {copy.list}
          </button>
        </div>
      </div>

      <div className={styles.region} aria-busy={phase === "loading" ? true : undefined} data-region="">
        {phase === "error" ? (
          <div className={styles.banner}>
            <HealthBanner message={copy.unavailable} />
          </div>
        ) : null}
        <div className={styles.phone}>
          <div className={styles.phoneCard}>
            <span className={styles.phoneTower} aria-hidden="true">
              <span className={styles.phoneBody} />
              <span className={styles.phoneSeam} />
            </span>
            <div className={styles.phoneFacts}>
              <LiveMark live={copy.live} offline={copy.offline} />
              <p>
                <span>{copy.projects}</span>
                <span>{figures && portfolio ? portfolio.totals.projects : copy.unknown}</span>
              </p>
              <p>
                <span>{copy.lastReceived}</span>
                <span>{towerLast}</span>
              </p>
            </div>
          </div>
        </div>
        <div className={styles.map} data-map="">
          <div className={styles.stageWrap}>
            <div className={styles.stage}>
              {phase === "ready" || phase === "offline" ? (
                <BladeField
                  blades={shown.map((project, slot) => ({
                    slot,
                    linkState: project.linkState,
                    dimmed: dimmed(project),
                  }))}
                  live={phase === "ready"}
                  offline={phase === "offline"}
                  signals={signals}
                />
              ) : null}
              <Tower
                copy={copy}
                stateWord={phase === "offline" ? copy.offline : copy.towerState}
                projects={figures && portfolio ? String(portfolio.totals.projects) : copy.unknown}
                fresh={figures && portfolio ? String(portfolio.totals.fresh) : copy.unknown}
                stale={figures && portfolio ? String(portfolio.totals.staleOrSilent) : copy.unknown}
                last={towerLast}
                ready={Boolean(figures && portfolio)}
                flashModules={flashModules}
              />
              {phase === "loading"
                ? SKELETON_SLOTS.map((slot) => <span key={slot} className={styles.skeleton} data-slot={slot} />)
                : null}
              {shown.map((project, slot) => (
                <ProjectCard
                  key={project.key}
                  project={project}
                  copy={copy}
                  now={now}
                  slot={slot}
                  placement="map"
                  dimmed={dimmed(project)}
                  selected={selected === project.key}
                  flash={flashes[project.key] ?? 0}
                  tint={Boolean(tint[project.key])}
                  onSelect={(key) => select(key, "map")}
                />
              ))}
              {overflow > 0 ? (
                <button type="button" className={styles.more} data-slot={7} onClick={() => setView("list")}>
                  {fill(copy.more, { count: String(overflow) })}
                </button>
              ) : null}
            </div>
          </div>
          <p className={styles.legend}>{copy.legend}</p>
        </div>
        {phase === "offline" ? <p className={styles.offlineNote}>{copy.offlineKnown}</p> : null}
        {phase === "error" || phase === "offline-first" ? (
          <StateBlock kind="error" message={copy.unavailable} />
        ) : null}
        {phase === "ready" && projects.length === 0 ? (
          <div className={styles.empty}>
            <p>{copy.empty}</p>
            <Link className={styles.register} href="/projects/new">
              {copy.register}
            </Link>
          </div>
        ) : null}
        <div className={styles.list}>
          {projects.map((project) => (
            <ProjectCard
              key={project.key}
              project={project}
              copy={copy}
              now={now}
              placement="list"
              dimmed={dimmed(project)}
              selected={selected === project.key}
              flash={flashes[project.key] ?? 0}
              tint={Boolean(tint[project.key])}
              onSelect={(key) => select(key, "list")}
            />
          ))}
        </div>
        {selectedProject ? <DetailPanel project={selectedProject} copy={copy} onClose={close} /> : null}
      </div>
      <Panels copy={copy} portfolio={portfolio} mode={figures ? "figures" : phase === "loading" ? "loading" : "hidden"} />
      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}
