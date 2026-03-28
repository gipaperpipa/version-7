const fs = require("node:fs");
const path = require("node:path");

const sourceDir = path.resolve(__dirname, "../../../packages/contracts/src");
const targetDir = path.resolve(__dirname, "../src/generated-contracts");
const files = [
  "common.ts",
  "enums.ts",
  "feasibility.ts",
  "funding.ts",
  "index.ts",
  "local-dev.ts",
  "parcels.ts",
  "planning-keys.ts",
  "planning.ts",
  "readiness.ts",
  "scenarios.ts",
];

fs.mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  const content = fs.readFileSync(sourcePath);
  fs.writeFileSync(targetPath, content);
}

console.log(`[sync-contracts] copied ${files.length} contract source files to ${targetDir}`);
