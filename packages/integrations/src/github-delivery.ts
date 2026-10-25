export type GithubDeliveryKind =
  | "branch"
  | "check_run"
  | "commit"
  | "deployment"
  | "pull_request"
  | "release"
  | "review";

export type DeliveryRiskSeverity = "high" | "medium";

export interface GithubRepositoryRef {
  defaultBranch?: string;
  fullName: string;
  htmlUrl?: string;
}

export interface NormalizedGithubDeliveryEvent {
  action: string;
  actorLogin?: string;
  occurredAt: string;
  externalId: string;
  kind: GithubDeliveryKind;
  ref?: string;
  repository: GithubRepositoryRef;
  status?: string;
  taskKeys: string[];
  url?: string;
}

export interface DeliveryTaskSignal {
  assigneeId?: string | null;
  id: string;
  priority: string;
  status: string;
  taskNumber: number;
  title: string;
  updatedAt: string;
}

export interface DeliveryRisk {
  id: string;
  nextMove: string;
  reason: string;
  severity: DeliveryRiskSeverity;
  taskId: string;
  taskNumber: number;
  title: string;
}

const TASK_KEY_PATTERN = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/gi;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function recordAt(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
}

function stringAt(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  return text(value[key]);
}

function numberAt(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  return number(value[key]);
}

function uniqueTaskKeys(values: Array<string | undefined>) {
  const matches = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(TASK_KEY_PATTERN)) {
      const key = match[1];
      if (key) matches.add(key.toUpperCase());
    }
  }
  return [...matches].sort();
}

function repositoryFromPayload(payload: Record<string, unknown>) {
  const repository = recordAt(payload, "repository");
  const fullName = stringAt(repository, "full_name");
  if (!fullName) return undefined;

  return {
    defaultBranch: stringAt(repository, "default_branch"),
    fullName,
    htmlUrl: stringAt(repository, "html_url"),
  } satisfies GithubRepositoryRef;
}

function actorFromPayload(payload: Record<string, unknown>) {
  return stringAt(recordAt(payload, "sender"), "login");
}

function occurredAtFromPayload(payload: Record<string, unknown>) {
  return (
    stringAt(payload, "updated_at") ??
    stringAt(payload, "created_at") ??
    new Date().toISOString()
  );
}

function pullRequestEvent(
  payload: Record<string, unknown>,
  action: string,
): NormalizedGithubDeliveryEvent | null {
  const pullRequest = recordAt(payload, "pull_request");
  const repository = repositoryFromPayload(payload);
  const externalNumber =
    numberAt(pullRequest, "number") ?? numberAt(payload, "number");
  if (!pullRequest || !repository || externalNumber === undefined) return null;

  const head = recordAt(pullRequest, "head");
  const base = recordAt(pullRequest, "base");
  const title = stringAt(pullRequest, "title");
  const body = stringAt(pullRequest, "body");
  const headRef = stringAt(head, "ref");
  const baseRef = stringAt(base, "ref");
  return {
    action,
    actorLogin: actorFromPayload(payload),
    externalId: `pull_request:${externalNumber}`,
    kind: "pull_request",
    occurredAt: occurredAtFromPayload(payload),
    ref: headRef ?? baseRef,
    repository,
    status: action,
    taskKeys: uniqueTaskKeys([title, body, headRef]),
    url: stringAt(pullRequest, "html_url"),
  };
}

export function extractTaskKeys(...values: Array<string | undefined>) {
  return uniqueTaskKeys(values);
}

export function normalizeGithubEvent(
  eventName: string,
  payload: unknown,
  deliveryId = "unknown",
): NormalizedGithubDeliveryEvent[] {
  if (!isRecord(payload)) return [];
  const repository = repositoryFromPayload(payload);
  if (!repository) return [];

  const action = stringAt(payload, "action") ?? "received";
  const actorLogin = actorFromPayload(payload);
  const occurredAt = occurredAtFromPayload(payload);
  const normalizedName = eventName.toLowerCase();

  if (normalizedName === "pull_request") {
    const event = pullRequestEvent(payload, action);
    return event
      ? [{ ...event, externalId: `${deliveryId}:${event.externalId}` }]
      : [];
  }

  if (normalizedName === "pull_request_review") {
    const review = recordAt(payload, "review");
    const pullRequest = recordAt(payload, "pull_request");
    const number = numberAt(pullRequest, "number");
    if (!review || !pullRequest || number === undefined) return [];
    return [
      {
        action,
        actorLogin,
        externalId: `${deliveryId}:review:${number}`,
        kind: "review",
        occurredAt,
        ref: stringAt(recordAt(pullRequest, "head"), "ref"),
        repository,
        status: stringAt(review, "state")?.toLowerCase() ?? action,
        taskKeys: uniqueTaskKeys([
          stringAt(pullRequest, "title"),
          stringAt(pullRequest, "body"),
          stringAt(review, "body"),
        ]),
        url: stringAt(review, "html_url") ?? stringAt(pullRequest, "html_url"),
      },
    ];
  }

  if (normalizedName === "push") {
    const commits = Array.isArray(payload.commits) ? payload.commits : [];
    const ref = stringAt(payload, "ref");
    const events = commits.flatMap((commit) => {
      if (!isRecord(commit)) return [];
      const sha = stringAt(commit, "id");
      if (!sha) return [];
      return [
        {
          action: "pushed",
          actorLogin,
          externalId: `${deliveryId}:commit:${sha}`,
          kind: "commit" as const,
          occurredAt,
          ref,
          repository,
          taskKeys: uniqueTaskKeys([
            stringAt(commit, "message"),
            ref,
            stringAt(payload, "head_commit"),
          ]),
          url: repository.htmlUrl
            ? `${repository.htmlUrl}/commit/${sha}`
            : undefined,
        },
      ];
    });
    if (events.length > 0) return events;

    const headCommit = recordAt(payload, "head_commit");
    const sha = stringAt(headCommit, "id");
    return sha
      ? [
          {
            action: "pushed",
            actorLogin,
            externalId: `${deliveryId}:commit:${sha}`,
            kind: "commit",
            occurredAt,
            ref,
            repository,
            taskKeys: uniqueTaskKeys([stringAt(headCommit, "message"), ref]),
            url: repository.htmlUrl
              ? `${repository.htmlUrl}/commit/${sha}`
              : undefined,
          },
        ]
      : [];
  }

  if (normalizedName === "check_run") {
    const checkRun = recordAt(payload, "check_run");
    const headBranch = stringAt(checkRun, "head_branch");
    const externalId = stringAt(checkRun, "id");
    if (!checkRun || !externalId) return [];
    return [
      {
        action,
        actorLogin,
        externalId: `${deliveryId}:check_run:${externalId}`,
        kind: "check_run",
        occurredAt,
        ref: headBranch,
        repository,
        status:
          stringAt(checkRun, "conclusion") ??
          stringAt(checkRun, "status") ??
          action,
        taskKeys: uniqueTaskKeys([stringAt(checkRun, "name"), headBranch]),
        url: stringAt(checkRun, "html_url"),
      },
    ];
  }

  if (normalizedName === "deployment_status") {
    const deploymentStatus = recordAt(payload, "deployment_status");
    const deployment = recordAt(payload, "deployment");
    const externalId = stringAt(deploymentStatus, "id");
    if (!deploymentStatus || !externalId) return [];
    const ref = stringAt(deployment, "ref") ?? stringAt(deployment, "sha");
    return [
      {
        action,
        actorLogin,
        externalId: `${deliveryId}:deployment:${externalId}`,
        kind: "deployment",
        occurredAt,
        ref,
        repository,
        status: stringAt(deploymentStatus, "state") ?? action,
        taskKeys: uniqueTaskKeys([ref, stringAt(deployment, "description")]),
        url: stringAt(deploymentStatus, "target_url"),
      },
    ];
  }

  if (normalizedName === "release") {
    const release = recordAt(payload, "release");
    const tagName = stringAt(release, "tag_name");
    const externalId = stringAt(release, "id");
    if (!release || !externalId) return [];
    return [
      {
        action,
        actorLogin,
        externalId: `${deliveryId}:release:${externalId}`,
        kind: "release",
        occurredAt,
        ref: tagName,
        repository,
        status: action,
        taskKeys: uniqueTaskKeys([
          tagName,
          stringAt(release, "name"),
          stringAt(release, "body"),
        ]),
        url: stringAt(release, "html_url"),
      },
    ];
  }

  if (normalizedName === "create" || normalizedName === "delete") {
    const refType = stringAt(payload, "ref_type");
    const ref = stringAt(payload, "ref");
    if (refType !== "branch" || !ref) return [];
    return [
      {
        action,
        actorLogin,
        externalId: `${deliveryId}:branch:${ref}`,
        kind: "branch",
        occurredAt,
        ref,
        repository,
        status: action,
        taskKeys: uniqueTaskKeys([ref]),
      },
    ];
  }

  return [];
}

export async function verifyGithubWebhookSignature(
  payload: string,
  signature: string | null | undefined,
  secret: string,
) {
  if (!signature?.startsWith("sha256=") || !secret) return false;
  const expected = signature.slice("sha256=".length).toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(expected)) return false;

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const digest = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const actual = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  let difference = actual.length ^ expected.length;
  for (let index = 0; index < actual.length; index += 1) {
    difference |=
      (actual.charCodeAt(index) ?? 0) ^ (expected.charCodeAt(index) ?? 0);
  }
  return difference === 0;
}

export function evaluateDeliveryRisks(
  tasks: readonly DeliveryTaskSignal[],
  now = new Date(),
  staleReviewHours = 48,
): DeliveryRisk[] {
  const risks: DeliveryRisk[] = [];
  const staleReviewMs = staleReviewHours * 60 * 60 * 1000;

  for (const task of tasks) {
    const taskLabel = `Task ${task.taskNumber}: ${task.title}`;
    if (task.status === "blocked") {
      risks.push({
        id: `blocked:${task.id}`,
        nextMove:
          "Resolve the blocker or update the dependency before more work lands.",
        reason: `${taskLabel} is explicitly marked blocked.`,
        severity: "high",
        taskId: task.id,
        taskNumber: task.taskNumber,
        title: "Blocked work needs attention",
      });
    }

    if (
      (task.priority === "urgent" || task.priority === "high") &&
      !task.assigneeId &&
      !["completed", "canceled"].includes(task.status)
    ) {
      risks.push({
        id: `unassigned:${task.id}`,
        nextMove:
          "Assign an owner or lower the priority until ownership is clear.",
        reason: `${taskLabel} is ${task.priority} priority but has no assignee.`,
        severity: task.priority === "urgent" ? "high" : "medium",
        taskId: task.id,
        taskNumber: task.taskNumber,
        title: "Priority work has no owner",
      });
    }

    const updatedAt = Date.parse(task.updatedAt);
    if (
      task.status === "in_review" &&
      !Number.isNaN(updatedAt) &&
      now.getTime() - updatedAt >= staleReviewMs
    ) {
      risks.push({
        id: `stale-review:${task.id}`,
        nextMove:
          "Assign a reviewer or record the decision that is keeping this work open.",
        reason: `${taskLabel} has been in review for at least ${staleReviewHours} hours.`,
        severity: "medium",
        taskId: task.id,
        taskNumber: task.taskNumber,
        title: "Review may be slowing delivery",
      });
    }
  }

  return risks.sort((left, right) => {
    const severityRank = { high: 0, medium: 1 } as const;
    return (
      severityRank[left.severity] - severityRank[right.severity] ||
      left.taskNumber - right.taskNumber
    );
  });
}
