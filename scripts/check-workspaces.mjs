import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceRoot = resolve(process.cwd());
const expectedWorkspaces = [
  "apps/web",
  "apps/vscode-extension",
  "packages/domain",
  "packages/integrations",
  "packages/ui",
];

const missingDirectories = [];
const missingManifests = [];
const invalidManifests = [];

for (const workspace of expectedWorkspaces) {
  const directory = resolve(workspaceRoot, workspace);
  const manifest = resolve(directory, "package.json");

  if (!existsSync(directory)) {
    missingDirectories.push(workspace);
    continue;
  }

  if (!existsSync(manifest)) {
    missingManifests.push(`${workspace}/package.json`);
    continue;
  }

  try {
    const packageJson = JSON.parse(readFileSync(manifest, "utf8"));
    if (typeof packageJson.name !== "string" || packageJson.name.length === 0) {
      invalidManifests.push(`${workspace}/package.json (missing a package name)`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    invalidManifests.push(`${workspace}/package.json (${message})`);
  }
}

if (missingDirectories.length > 0) {
  console.error("Workspace directories are missing:");
  for (const workspace of missingDirectories) {
    console.error(`  - ${workspace} (create the workspace before running this command)`);
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

if (missingDirectories.length > 0 || missingManifests.length > 0 || invalidManifests.length > 0) {
  process.exitCode = 1;
} else {
  console.log(`Validated ${expectedWorkspaces.length} ProjectPulse workspaces.`);
}
