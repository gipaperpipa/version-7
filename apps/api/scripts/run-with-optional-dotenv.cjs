const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function stripQuotes(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const lines = fs.readFileSync(envFilePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = stripQuotes(rawValue);
  }
}

function main() {
  const [envFile, command, ...args] = process.argv.slice(2);

  if (!command) {
    throw new Error("Usage: node run-with-optional-dotenv.cjs <env-file> <command> [...args]");
  }

  loadEnvFile(path.resolve(process.cwd(), envFile));

  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main();
