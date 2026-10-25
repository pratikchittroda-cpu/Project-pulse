import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const requiredFiles = [
  ".gitignore",
  ".nvmrc",
  "Makefile",
  "README.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/check-bootstrap.mjs",
  "scripts/check-workspaces.mjs",
];
const requiredDirectories = [
  "apps/web",
  "apps/vscode-extension",
  "packages/domain",
  "packages/integrations",
  "packages/ui",
];
const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) {
    failures.push(`missing required file: ${file}`);
  }
}

for (const directory of requiredDirectories) {
  if (!existsSync(resolve(root, directory))) {
    failures.push(`missing workspace directory: ${directory}`);
  }
}

if (failures.length === 0) {
  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf8"),
    );
    const runtimePin = readFileSync(resolve(root, ".nvmrc"), "utf8").trim();
    const workspaceConfig = readFileSync(
      resolve(root, "pnpm-workspace.yaml"),
      "utf8",
    );
    const readme = readFileSync(resolve(root, "README.md"), "utf8");

    if (runtimePin !== "22.14.0") {
      failures.push(`.nvmrc must pin Node.js 22.14.0, found: ${runtimePin}`);
    }
    if (packageJson.private !== true) {
      failures.push("package.json must mark the root package as private");
    }
    if (packageJson.packageManager !== "pnpm@10.12.1") {
      failures.push(
        `package.json must pin pnpm@10.12.1, found: ${packageJson.packageManager ?? "missing"}`,
      );
    }
    if (
      !workspaceConfig.includes('  - "apps/*"') ||
      !workspaceConfig.includes('  - "packages/*"')
    ) {
      failures.push("pnpm-workspace.yaml must include apps/* and packages/*");
    }
    if (!readme.includes("corepack pnpm install --frozen-lockfile")) {
      failures.push(
        "README.md must document the frozen-lockfile setup command",
      );
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  console.error("ReleaseArc bootstrap checks failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("ReleaseArc bootstrap checks passed.");
}
