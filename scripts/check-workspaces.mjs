import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceRoot = resolve(process.cwd());
const expectedWorkspaces = [
  { directory: "apps/web", name: "@releasearc/web" },
  {
    directory: "apps/vscode-extension",
    name: "releasearc-vscode-extension",
  },
  { directory: "packages/domain", name: "@releasearc/domain" },
  {
    directory: "packages/integrations",
    name: "@releasearc/integrations",
  },
  { directory: "packages/ui", name: "@releasearc/ui" },
];

const missingDirectories = [];
const missingManifests = [];
const invalidManifests = [];
const requiredScripts = ["build", "test", "lint", "typecheck"];

for (const workspace of expectedWorkspaces) {
  const directory = resolve(workspaceRoot, workspace.directory);
  const manifest = resolve(directory, "package.json");

  if (!existsSync(directory)) {
    missingDirectories.push(workspace.directory);
    continue;
  }

  if (!existsSync(manifest)) {
    missingManifests.push(`${workspace.directory}/package.json`);
    continue;
  }

  try {
    const packageJson = JSON.parse(readFileSync(manifest, "utf8"));
    if (packageJson.name !== workspace.name) {
      invalidManifests.push(
        `${workspace.directory}/package.json (expected name ${workspace.name})`,
      );
    }
    if (packageJson.private !== true) {
      invalidManifests.push(
        `${workspace.directory}/package.json (workspace packages must be private)`,
      );
    }
    for (const script of requiredScripts) {
      if (typeof packageJson.scripts?.[script] !== "string") {
        invalidManifests.push(
          `${workspace.directory}/package.json (missing ${script} script)`,
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    invalidManifests.push(`${workspace.directory}/package.json (${message})`);
  }
}

if (missingDirectories.length > 0) {
  console.error("Workspace directories are missing:");
  for (const workspace of missingDirectories) {
    console.error(
      `  - ${workspace} (create the workspace before running this command)`,
    );
  }
}

if (missingManifests.length > 0) {
  console.error("Workspace package manifests are missing:");
  for (const manifest of missingManifests) {
    console.error(`  - ${manifest} (T002 must add this workspace manifest)`);
  }
}

if (invalidManifests.length > 0) {
  console.error("Workspace package manifests are invalid:");
  for (const manifest of invalidManifests) {
    console.error(`  - ${manifest}`);
  }
}

if (
  missingDirectories.length > 0 ||
  missingManifests.length > 0 ||
  invalidManifests.length > 0
) {
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${expectedWorkspaces.length} ReleaseArc workspaces and shared scripts.`,
  );
}
