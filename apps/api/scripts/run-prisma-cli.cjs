const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const workspaceRoot = path.resolve(__dirname, "../../..");
const virtualStoreDir = path.join(workspaceRoot, "node_modules", ".pnpm");

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found at ${targetPath}`);
  }
}

function findVirtualStoreEntry(prefix) {
  assertExists(virtualStoreDir, "Virtual store directory");
  const match = fs.readdirSync(virtualStoreDir).find((entry) => entry.startsWith(prefix));
  if (!match) {
    throw new Error(`Unable to find virtual store entry starting with "${prefix}"`);
  }
  return path.join(virtualStoreDir, match);
}

function resolvePrismaCliEntrypoint() {
  const prismaStoreDir = findVirtualStoreEntry("prisma@");
  const prismaPackageDir = path.join(prismaStoreDir, "node_modules", "prisma");
  const cliEntrypoint = path.join(prismaPackageDir, "build", "index.js");
  assertExists(cliEntrypoint, "Prisma CLI entrypoint");
  return cliEntrypoint;
}

function main() {
  const cliEntrypoint = resolvePrismaCliEntrypoint();
  const result = spawnSync(process.execPath, [cliEntrypoint, ...process.argv.slice(2)], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 0);
}

main();
