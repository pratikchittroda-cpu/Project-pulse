import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const [expectedName, checkName = "test"] = process.argv.slice(2);
const workspaceRoot = resolve(process.cwd());
const manifestPath = resolve(workspaceRoot, "package.json");
const sourcePath = resolve(workspaceRoot, "src/index.ts");

if (!expectedName) {
  console.error("Usage: node check-workspace-package.mjs <package-name> [check]");
  process.exit(1);
}

const failures = [];

if (!existsSync(manifestPath)) {
  failures.push("package.json is missing");
} else {
  try {
    const packageJson = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (packageJson.name !== expectedName) {
      failures.push(`expected package name ${expectedName}`);
    }
    if (packageJson.private !== true) {
      failures.push("workspace packages must be private");
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (!existsSync(sourcePath)) {
  failures.push("src/index.ts is missing");
}

if (failures.length > 0) {
  console.error(`${expectedName} ${checkName} check failed:`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`${expectedName} ${checkName} check passed.`);
