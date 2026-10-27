// Pure supervisor rules. Nothing runs on import: no config, no filesystem, no gh.
// The supervisor (supervisor.mjs) is the only caller that talks to GitHub.

export const ENV_RE = /ECONNRESET|ETIMEDOUT|EAI_AGAIN|Could not resolve host|50[234] (Bad Gateway|Service Unavailable|Gateway Timeout)|rate limit exceeded|toomanyrequests|failed to pull|registry\.npmjs\.org.*(timeout|ECONN)|The operation was canceled|runner has received a shutdown signal|lost communication with the server/i;

export const FONTS_RE = /Google Fonts download failed|could not download the Google Fonts|next\/font\/google queries|fonts\.(googleapis|gstatic)\.com|Failed to fetch .*Google Fonts/i;

export const FENCE_MISSING_RE = /docs\/fences\/(T\d\d)\.md does not exist/;

const STEP_ENV_RE = /^(Install|Set up|Run actions\/|Supabase CLI|Firebase CLI|Local module services|Check out)/;

/** Classify one failed cycle run. A missing fence is first, so a checkout step that only
 *  failed because the reviewer has not written the fence is never re-run as an environment failure. */
export function runFailureRule({ step, tail, task, attempt, run }) {
  const text = String(tail ?? "");
  const fenceHit = text.match(FENCE_MISSING_RE);
  if (fenceHit) {
    const fence = fenceHit[1];
    return {
      rule: "fence-missing",
      key: `${fence}:fence-missing`,
      cause: `docs/fences/${fence}.md does not exist: the task cannot start until the reviewer writes it`,
      action: "fence-wait",
      rescue: null,
      fence,
    };
  }
  if (/exceeds max_attempts/.test(text)) {
    return {
      rule: "attempt-limit",
      key: `${task}:a${attempt}:attempt-limit:${run}`,
      cause: "the resumed run lost its revision flag and was refused as an attempt over max_attempts",
      action: "redispatch",
      rescue: null,
      fence: null,
    };
  }
  const rescue = (text.match(/saved on branch (rescue\/\S+?)[ .(]/) || [])[1] ?? null;
  if (/conflicts with this task's work/.test(text)) {
    return {
      rule: "push-conflict",
      key: `${task}:a${attempt}:push-conflict`,
      cause: "main changed during the run and the push conflicted",
      action: rescue ? "recover-rescue" : "redispatch",
      rescue,
      fence: null,
    };
  }
  if (/has timed out/.test(text)) {
    return {
      rule: "step-timeout",
      key: `${task}:a${attempt}:step-timeout`,
      cause: `step "${step}" timed out`,
      action: "redispatch",
      rescue: null,
      fence: null,
    };
  }
  if (ENV_RE.test(text) || STEP_ENV_RE.test(step)) {
    return {
      rule: "env",
      key: `${task}:a${attempt}:env:${step}`,
      cause: `an environment failure in "${step}"`,
      action: "rerun-failed",
      rescue: null,
      fence: null,
    };
  }
  if (/no Cursor key|no Claude|set secret|Setup needed|permission/i.test(text)) {
    return {
      rule: "setup",
      key: `${task}:setup`,
      cause: "a missing secret, variable or permission",
      action: "setup",
      rescue: null,
      fence: null,
    };
  }
  return {
    rule: "unknown",
    key: `${task}:a${attempt}:unknown:${step}`,
    cause: "",
    action: "ask-claude",
    rescue: null,
    fence: null,
  };
}

function fenceWaitSteps(task) {
  return [
    `1. have the reviewer write \`docs/fences/${task}.md\` and put it on main (an interactive \`claude\` session in this repository; it changes only \`docs/fences/**\`);`,
    `2. once it is on main, the supervisor's next scan starts ${task}, or run devos-cycle with \`task=${task}\` \`attempt=1\`.`,
  ].join("\n");
}

/** Rule 4. Returns null unless the queue is idle and the next task has no open task PR.
 *  A missing fence waits; it is never dispatched. */
export function idleIncident({ next, fence, busy, waitingForOwner, otherIncidents, intakePrs, minutesSinceLastRun, idleMinutes, taskPrHeads }) {
  if (!next || busy || waitingForOwner) return null;
  if (otherIncidents !== 0 || intakePrs !== 0) return null;
  if (!(minutesSinceLastRun === null || minutesSinceLastRun > idleMinutes)) return null;
  if (taskPrHeads.includes(`task/${next.task}`)) return null;
  if (fence === true) {
    const mins = minutesSinceLastRun === null ? "?" : Math.round(minutesSinceLastRun);
    return {
      kind: "idle",
      task: next.task,
      key: `${next.task}:idle`,
      cause: `nothing has run for ${mins} min and ${next.task} is waiting`,
      action: "dispatch-next",
      owner_steps: "",
    };
  }
  if (fence === false) {
    return {
      kind: "fence-missing",
      task: next.task,
      key: `${next.task}:fence-missing`,
      cause: `docs/fences/${next.task}.md is not on main: the task cannot start until the reviewer writes it`,
      action: "fence-wait",
      owner_steps: fenceWaitSteps(next.task),
    };
  }
  return null;
}

/** Task ids a merged plan names: `\bTnn\b` in lines added to docs/PHASES.md, plus every
 *  `docs/fences/Tnn.md` it changed. Sorted and unique. */
export function tasksNamedByPlan(beforeText, afterText, changedFiles = []) {
  const before = new Set(String(beforeText).split(/\r?\n/));
  const ids = new Set();
  for (const line of String(afterText).split(/\r?\n/)) {
    if (before.has(line)) continue;
    for (const m of line.matchAll(/\bT\d\d\b/g)) ids.add(m[0]);
  }
  for (const changed of changedFiles) {
    const m = String(changed).match(/docs\/fences\/(T\d\d)\.md$/);
    if (m) ids.add(m[1]);
  }
  return [...ids].sort();
}
