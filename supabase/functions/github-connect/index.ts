import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const webhookSecret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
const webhookEvents = [
  "pull_request",
  "pull_request_review",
  "push",
  "check_run",
  "deployment_status",
  "release",
];

const admin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function textAt(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  return text(value[key]);
}

function numberAt(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  return number(value[key]);
}

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function jsonResponse(request: Request, body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders(request),
    status,
  });
}

function normalizeRepositoryUrl(value: string) {
  return value
    .trim()
    .replace(/\.git$/iu, "")
    .replace(/\/$/u, "")
    .toLowerCase();
}

function parseGithubRepositoryUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== "github.com"
  ) {
    return null;
  }

  const segments = parsed.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  if (segments.length !== 2) return null;

  const owner = segments[0];
  const repository = segments[1]?.replace(/\.git$/iu, "");
  if (!owner || !repository) return null;

  return {
    owner,
    repository,
    url: `https://github.com/${owner}/${repository}`,
  };
}

async function githubRequest(
  path: string,
  accessToken: string,
  init: RequestInit = {},
) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ReleaseArc",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
}

async function githubErrorResponse(
  request: Request,
  response: Response,
  fallback: string,
) {
  if (response.status === 401) {
    return jsonResponse(
      request,
      { error: "GitHub authorization expired. Connect GitHub again." },
      401,
    );
  }
  if (response.status === 403) {
    return jsonResponse(
      request,
      {
        error:
          "GitHub denied this action. Reconnect with repository and webhook permissions.",
      },
      403,
    );
  }
  if (response.status === 404) {
    return jsonResponse(
      request,
      { error: "Repository was not found or is not accessible to GitHub." },
      404,
    );
  }
  return jsonResponse(request, { error: fallback }, 502);
}

function webhookUrl() {
  return `${supabaseUrl}/functions/v1/github-webhook`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed" }, 405);
  }
  if (!admin || !supabaseUrl || !serviceRoleKey || !anonKey || !webhookSecret) {
    return jsonResponse(
      request,
      { error: "GitHub connection is not configured" },
      503,
    );
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/iu, "").trim();
  if (!accessToken) {
    return jsonResponse(request, { error: "Authentication is required" }, 401);
  }

  const { data: userData, error: userError } =
    await admin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonResponse(request, { error: "Authentication is required" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      request,
      { error: "Request body must be valid JSON" },
      400,
    );
  }
  if (!isRecord(body)) {
    return jsonResponse(
      request,
      { error: "Request body must be an object" },
      400,
    );
  }

  const projectId = text(body.project_id);
  const repositoryUrl = text(body.repository_url);
  const githubAccessToken = text(body.github_access_token);
  if (!projectId || !repositoryUrl || !githubAccessToken) {
    return jsonResponse(
      request,
      {
        error:
          "project_id, repository_url, and a GitHub connection are required",
      },
      400,
    );
  }

  const parsedRepository = parseGithubRepositoryUrl(repositoryUrl);
  if (!parsedRepository) {
    return jsonResponse(
      request,
      { error: "Use a full HTTPS GitHub repository URL." },
      400,
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: project, error: projectError } = await userClient
    .from("projects")
    .select("id, organization_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project) {
    return jsonResponse(request, { error: "Project was not found" }, 404);
  }

  const { data: canWrite, error: permissionError } = await userClient.rpc(
    "can_write_project",
    {
      target_organization_id: project.organization_id,
      target_project_id: project.id,
    },
  );
  if (permissionError || canWrite !== true) {
    return jsonResponse(
      request,
      { error: "You do not have permission to connect this repository." },
      403,
    );
  }

  const repositoryResponse = await githubRequest(
    `/repos/${encodeURIComponent(parsedRepository.owner)}/${encodeURIComponent(parsedRepository.repository)}`,
    githubAccessToken,
  );
  if (!repositoryResponse.ok) {
    return githubErrorResponse(
      request,
      repositoryResponse,
      "GitHub repository lookup failed.",
    );
  }
  const repositoryPayload = (await repositoryResponse.json()) as unknown;
  const repositoryName = textAt(repositoryPayload, "name");
  const repositoryFullName = textAt(repositoryPayload, "full_name");
  const repositoryHtmlUrl = textAt(repositoryPayload, "html_url");
  const defaultBranch = textAt(repositoryPayload, "default_branch") ?? "main";
  if (!repositoryName || !repositoryFullName || !repositoryHtmlUrl) {
    return jsonResponse(
      request,
      { error: "GitHub returned incomplete repository metadata." },
      502,
    );
  }

  const hookEndpoint = webhookUrl();
  const hooksResponse = await githubRequest(
    `/repos/${encodeURIComponent(parsedRepository.owner)}/${encodeURIComponent(parsedRepository.repository)}/hooks?per_page=100`,
    githubAccessToken,
  );
  if (!hooksResponse.ok) {
    return githubErrorResponse(
      request,
      hooksResponse,
      "GitHub webhook lookup failed.",
    );
  }
  const hooksPayload = (await hooksResponse.json()) as unknown;
  const hooks = Array.isArray(hooksPayload) ? hooksPayload : [];
  const existingHook = hooks.find((candidate) => {
    if (!isRecord(candidate)) return false;
    const config = candidate.config;
    return (
      normalizeRepositoryUrl(textAt(config, "url") ?? "") ===
      normalizeRepositoryUrl(hookEndpoint)
    );
  });

  const hookBody = {
    active: true,
    config: {
      content_type: "json",
      insecure_ssl: "0",
      secret: webhookSecret,
      url: hookEndpoint,
    },
    events: webhookEvents,
    name: "web",
  };

  let hookId: number | undefined;
  let hookCreated = false;
  if (isRecord(existingHook)) {
    hookId = numberAt(existingHook, "id");
    if (hookId === undefined) {
      return jsonResponse(
        request,
        { error: "Existing GitHub webhook is invalid." },
        502,
      );
    }
    const updateResponse = await githubRequest(
      `/repos/${encodeURIComponent(parsedRepository.owner)}/${encodeURIComponent(parsedRepository.repository)}/hooks/${hookId}`,
      githubAccessToken,
      {
        body: JSON.stringify(hookBody),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
    );
    if (!updateResponse.ok) {
      return githubErrorResponse(
        request,
        updateResponse,
        "GitHub webhook update failed.",
      );
    }
  } else {
    const createResponse = await githubRequest(
      `/repos/${encodeURIComponent(parsedRepository.owner)}/${encodeURIComponent(parsedRepository.repository)}/hooks`,
      githubAccessToken,
      {
        body: JSON.stringify(hookBody),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    if (!createResponse.ok) {
      return githubErrorResponse(
        request,
        createResponse,
        "GitHub webhook creation failed.",
      );
    }
    const createdHook = (await createResponse.json()) as unknown;
    hookId = numberAt(createdHook, "id");
    hookCreated = true;
  }

  const { data: repository, error: repositoryError } = await userClient
    .from("repositories")
    .upsert(
      {
        default_branch: defaultBranch,
        name: repositoryName,
        organization_id: project.organization_id,
        project_id: project.id,
        provider: "github",
        url: repositoryHtmlUrl,
      },
      { onConflict: "project_id,url" },
    )
    .select("id, name, provider, url, default_branch")
    .single();

  if (repositoryError || !repository) {
    if (hookCreated && hookId !== undefined) {
      await githubRequest(
        `/repos/${encodeURIComponent(parsedRepository.owner)}/${encodeURIComponent(parsedRepository.repository)}/hooks/${hookId}`,
        githubAccessToken,
        { method: "DELETE" },
      );
    }
    return jsonResponse(
      request,
      { error: "Webhook connected, but the repository could not be saved." },
      500,
    );
  }

  return jsonResponse(request, {
    connected: true,
    repository: {
      default_branch: repository.default_branch,
      id: repository.id,
      name: repository.name,
      provider: repository.provider,
      url: repository.url,
    },
    webhook: {
      created: hookCreated,
      events: webhookEvents,
      id: hookId ?? null,
    },
  });
});
