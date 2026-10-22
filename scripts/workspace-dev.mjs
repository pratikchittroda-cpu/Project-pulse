const [packageName] = process.argv.slice(2);

if (!packageName) {
  console.error("Usage: node workspace-dev.mjs <package-name>");
  process.exit(1);
}

console.log(`${packageName} has no standalone development server yet.`);
console.log("Use the web workspace for the local development entry point.");
