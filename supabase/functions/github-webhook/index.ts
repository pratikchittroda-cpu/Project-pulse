import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

interface NormalizedEvent {
  action: string;
  actor_login?: string;
  external_id: string;
  kind:
    | "branch"
    | "check_run"
    | "commit"
    | "deployment"
    | "pull_request"
    | "release"
    | "review";
  metadata?: JsonRecord;
  occurred_at: string;
  ref?: string;
  status?: string;
  task_keys: string[];
  url?: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const webhookSecret = Deno.env.get("GITHUB_WEBHOOK_SECRET");

const admin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function recordAt(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function textAt(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  return text(value[key]);
}

function numberAt(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : undefined;
}

function safeDate(payload: JsonRecord) {
  const candidate =
    textAt(payload, "updated_at") ??
    textAt(payload, "published_at") ??
    textAt(payload, "created_at") ??
    textAt(payload, "run_started_at");
  return candidate && !Number.isNaN(Date.parse(candidate))
    ? new Date(candidate).toISOString()
    : new Date().toISOString();
}

function taskKeys(...values: Array<string | undefined>) {
  const keys = new Set<string>();
  const pattern = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/gi;
  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(pattern)) {
      if (match[1]) keys.add(match[1].toUpperCase());
    }
  }
  return [...keys].sort();
}

function repositoryName(payload: JsonRecord) {
  return textAt(recordAt(payload, "repository"), "full_name");
}

function actorLogin(payload: JsonRecord) {
  return textAt(recordAt(payload, "sender"), "login");
}

function eventBase(
  payload: JsonRecord,
  deliveryId: string,
  kind: NormalizedEvent["kind"],
  action: string,
  externalPart: string,
): NormalizedEvent {
  return {
    action,
    actor_login: actorLogin(payload),
    external_id: `${deliveryId}:${kind}:${externalPart}`,
    kind,
    occurred_at: safeDate(payload),
    task_keys: [],
  };
}

function normalizeEvent(
  eventName: string,
  payload: JsonRecord,
  deliveryId: string,
): NormalizedEvent[] {
  const action = textAt(payload, "action") ?? "received";
  const occurredAt = safeDate(payload);

  if (eventName === "pull_request") {
    const pullRequest = recordAt(payload, "pull_request");
    const number = numberAt(pullRequest, "number");
    if (!pullRequest || number === undefined) return [];
    const head = recordAt(pullRequest, "head");
    const headRef = textAt(head, "ref");
    const merged = pullRequest.merged === true;
    const status = merged
      ? "merged"
      : action === "synchronize"
        ? "open"
        : action;
    return [
      {
        ...eventBase(
          payload,
          deliveryId,
          "pull_request",
          action,
          String(number),
        ),
        metadata: { number },
        occurred_at: occurredAt,
        ref: headRef,
        status,
        task_keys: taskKeys(
          textAt(pullRequest, "title"),
          textAt(pullRequest, "body"),
          headRef,
        ),
        url: textAt(pullRequest, "html_url"),
      },
    ];
  }

  if (eventName === "pull_request_review") {
    const review = recordAt(payload, "review");
    const pullRequest = recordAt(payload, "pull_request");
    const number = numberAt(pullRequest, "number");
    const reviewId = textAt(review, "id");
    if (!review || !pullRequest || number === undefined || !reviewId) return [];
    return [
      {
        ...eventBase(
          payload,
          deliveryId,
          "review",
          action,
          `${number}:${reviewId}`,
        ),
        metadata: { number, review_id: reviewId },
        occurred_at: occurredAt,
        ref: textAt(recordAt(pullRequest, "head"), "ref"),
        status: (textAt(review, "state") ?? action).toLowerCase(),
        task_keys: taskKeys(
          textAt(pullRequest, "title"),
          textAt(pullRequest, "body"),
          textAt(review, "body"),
        ),
        url: textAt(review, "html_url") ?? textAt(pullRequest, "html_url"),
      },
    ];
  }

  if (eventName === "push") {
    const commits = Array.isArray(payload.commits) ? payload.commits : [];
    const ref = textAt(payload, "ref");
    const events = commits.flatMap((candidate) => {
      if (!isRecord(candidate)) return [];
      const sha = textAt(candidate, "id");
      if (!sha) return [];
      return [
        {
          ...eventBase(payload, deliveryId, "commit", "pushed", sha),
          metadata: { commit_count: commits.length },
          occurred_at: occurredAt,
          ref,
          status: "pushed",
          task_keys: taskKeys(textAt(candidate, "message"), ref),
          url: repositoryName(payload)
            ? `https://github.com/${repositoryName(payload)}/commit/${sha}`
            : undefined,
        },
      ];
    });
    if (events.length > 0) return events;
    const headCommit = recordAt(payload, "head_commit");
    const sha = textAt(headCommit, "id");
    return sha
      ? [
          {
            ...eventBase(payload, deliveryId, "commit", "pushed", sha),
            occurred_at: occurredAt,
            ref,
            status: "pushed",
            task_keys: taskKeys(textAt(headCommit, "message"), ref),
          },
        ]
      : [];
  }

  if (eventName === "check_run") {
    const checkRun = recordAt(payload, "check_run");
    const id = textAt(checkRun, "id");
    if (!checkRun || !id) return [];
    return [
      {
        ...eventBase(payload, deliveryId, "check_run", action, id),
        metadata: { name: textAt(checkRun, "name") },
        occurred_at: occurredAt,
        ref: textAt(checkRun, "head_branch"),
        status: (
          textAt(checkRun, "conclusion") ??
          textAt(checkRun, "status") ??
          action
        ).toLowerCase(),
        task_keys: taskKeys(
          textAt(checkRun, "name"),
          textAt(checkRun, "head_branch"),
        ),
        url: textAt(checkRun, "html_url"),
      },
    ];
  }

  if (eventName === "deployment_status") {
    const deploymentStatus = recordAt(payload, "deployment_status");
    const deployment = recordAt(payload, "deployment");
    const id = textAt(deploymentStatus, "id");
    if (!deploymentStatus || !id) return [];
    const ref = textAt(deployment, "ref") ?? textAt(deployment, "sha");
    return [
      {
        ...eventBase(payload, deliveryId, "deployment", action, id),
        occurred_at: occurredAt,
        ref,
        status: (textAt(deploymentStatus, "state") ?? action).toLowerCase(),
        task_keys: taskKeys(ref, textAt(deployment, "description")),
        url: textAt(deploymentStatus, "target_url"),
      },
    ];
  }

  if (eventName === "release") {
    const release = recordAt(payload, "release");
    const id = textAt(release, "id");
    const tag = textAt(release, "tag_name");
    if (!release || !id) return [];
    return [
      {
        ...eventBase(payload, deliveryId, "release", action, id),
        occurred_at: occurredAt,
        ref: tag,
        status: action,
        task_keys: taskKeys(
          tag,
          textAt(release, "name"),
          textAt(release, "body"),
        ),
        url: textAt(release, "html_url"),
      },
    ];
  }

  if (eventName === "create" || eventName === "delete") {
    const refType = textAt(payload, "ref_type");
    const ref = textAt(payload, "ref");
    if (refType !== "branch" || !ref) return [];
    return [
      {
        ...eventBase(payload, deliveryId, "branch", action, ref),
        occurred_at: occurredAt,
        ref,
        status: action,
        task_keys: taskKeys(ref),
      },
    ];
  }

  return [];
}

function normalizeRepositoryUrl(value: string) {
  return value
    .trim()
    .replace(/\.git$/i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

async function verifySignature(payload: string, signature: string | null) {
  if (!webhookSecret || !signature?.startsWith("sha256=")) return false;
  const expected = signature.slice("sha256=".length).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
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

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  if (!admin || !webhookSecret) {
    return jsonResponse({ error: "GitHub webhook is not configured" }, 503);
  }

  const rawPayload = await request.text();
  if (
    !(await verifySignature(
      rawPayload,
      request.headers.get("x-hub-signature-256"),
    ))
  ) {
    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  const deliveryId = request.headers.get("x-github-delivery");
  const eventName = request.headers.get("x-github-event")?.toLowerCase();
  if (!deliveryId || !eventName) {
    return jsonResponse({ error: "GitHub delivery headers are required" }, 400);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return jsonResponse({ error: "Webhook payload must be valid JSON" }, 400);
  }
  if (!isRecord(payload)) {
    return jsonResponse({ error: "Webhook payload must be an object" }, 400);
  }

  const fullName = repositoryName(payload);
  if (!fullName) {
    return jsonResponse({
      accepted: true,
      ignored: true,
      reason: "repository_missing",
    });
  }

  const { data: repositories, error: repositoryError } = await admin
    .from("repositories")
    .select("id, url")
    .eq("provider", "github")
    .limit(1000);
  if (repositoryError) {
    return jsonResponse(
      { error: "Could not resolve the GitHub repository" },
      500,
    );
  }

  const expectedUrl = normalizeRepositoryUrl(`https://github.com/${fullName}`);
  const repository = (repositories ?? []).find(
    (candidate) => normalizeRepositoryUrl(candidate.url) === expectedUrl,
  );
  if (!repository) {
    return jsonResponse({
      accepted: true,
      ignored: true,
      reason: "repository_not_registered",
    });
  }

  const normalizedEvents = normalizeEvent(eventName, payload, deliveryId);
  const { data, error } = await admin.rpc("ingest_github_delivery", {
    target_delivery_id: deliveryId,
    target_event_type: eventName,
    target_normalized_events: normalizedEvents,
    target_payload: payload,
    target_repository_id: repository.id,
  });
  if (error) {
    return jsonResponse(
      { error: "Could not persist the GitHub delivery" },
      500,
    );
  }

  return jsonResponse({ accepted: true, result: data ?? null });
});
