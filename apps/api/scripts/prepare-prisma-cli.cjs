const fs = require("fs");
const path = require("path");

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

function getVirtualStorePackagePath(prefix, relativePath) {
  return path.join(findVirtualStoreEntry(prefix), "node_modules", ...relativePath);
}

function ensurePrismaPackageDir() {
  const prismaStoreDir = findVirtualStoreEntry("prisma@");
  const prismaNodeModulesDir = path.join(prismaStoreDir, "node_modules");
  const prismaPackageDir = path.join(prismaNodeModulesDir, "prisma");

  if (!fs.existsSync(prismaPackageDir)) {
    const tempDirName = fs.readdirSync(prismaNodeModulesDir).find((entry) => entry.startsWith("prisma_tmp_"));
    if (!tempDirName) {
      throw new Error("Unable to find Prisma CLI package directory.");
    }
    fs.renameSync(path.join(prismaNodeModulesDir, tempDirName), prismaPackageDir);
  }

  return prismaPackageDir;
}

function ensureEnginesEntrypoint(enginesVersion) {
  const enginesStoreDir = findVirtualStoreEntry("@prisma+engines@");
  const enginesPackageDir = path.join(enginesStoreDir, "node_modules", "@prisma", "engines");
  const distDir = path.join(enginesPackageDir, "dist");

  fs.mkdirSync(distDir, { recursive: true });

  const packageJsonPath = path.join(enginesPackageDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    fs.writeFileSync(
      packageJsonPath,
      `${JSON.stringify({
        name: "@prisma/engines",
        version: "6.19.2",
        main: "dist/index.js",
        types: "dist/index.d.ts",
        license: "Apache-2.0",
        prisma: { enginesVersion },
      }, null, 2)}\n`,
      "utf8",
    );
  }

  const indexJsPath = path.join(distDir, "index.js");
  if (!fs.existsSync(indexJsPath)) {
    fs.writeFileSync(
      indexJsPath,
      `"use strict";\nconst path = require("path");\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.getCliQueryEngineBinaryType = exports.getEnginesPath = exports.ensureNeededBinariesExist = exports.enginesVersion = void 0;\nexports.enginesVersion = require("@prisma/engines-version").enginesVersion;\nconst ensureNeededBinariesExist = async () => undefined;\nconst getEnginesPath = () => path.resolve(__dirname, "..");\nconst getCliQueryEngineBinaryType = () => process.env.PRISMA_CLI_QUERY_ENGINE_TYPE === "library" ? "libquery-engine" : "query-engine";\nexports.ensureNeededBinariesExist = ensureNeededBinariesExist;\nexports.getEnginesPath = getEnginesPath;\nexports.getCliQueryEngineBinaryType = getCliQueryEngineBinaryType;\n`,
      "utf8",
    );
  }

  const indexDtsPath = path.join(distDir, "index.d.ts");
  if (!fs.existsSync(indexDtsPath)) {
    fs.writeFileSync(
      indexDtsPath,
      "export declare const enginesVersion: string;\nexport declare const ensureNeededBinariesExist: (input?: unknown) => Promise<void>;\nexport declare const getEnginesPath: () => string;\nexport declare const getCliQueryEngineBinaryType: () => \"query-engine\" | \"libquery-engine\";\n",
      "utf8",
    );
  }
}

function ensurePrismaSchemaWasm(prismaPackageDir) {
  const sourcePath = getVirtualStorePackagePath(
    "@prisma+prisma-schema-wasm@",
    ["@prisma", "prisma-schema-wasm", "src", "prisma_schema_build_bg.wasm"],
  );
  const targetPath = path.join(prismaPackageDir, "build", "prisma_schema_build_bg.wasm");

  assertExists(sourcePath, "Prisma schema WASM");

  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function main() {
  const prismaPackageDir = ensurePrismaPackageDir();
  const enginesVersionPackageJson = getVirtualStorePackagePath(
    "@prisma+engines-version@",
    ["@prisma", "engines-version", "package.json"],
  );
  const { prisma: prismaMetadata } = JSON.parse(fs.readFileSync(enginesVersionPackageJson, "utf8"));
  const enginesVersion = prismaMetadata.enginesVersion;
  ensureEnginesEntrypoint(enginesVersion);
  ensurePrismaSchemaWasm(prismaPackageDir);
}

main();
