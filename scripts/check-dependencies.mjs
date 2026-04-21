import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
  npmCommand,
  ["audit", "--omit=dev", "--audit-level=high", "--json"],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }
);

let report = null;

if (result.stdout) {
  try {
    report = JSON.parse(result.stdout);
  } catch {
    report = null;
  }
}

const vulnerabilitySummary = report?.metadata?.vulnerabilities ?? null;

if (vulnerabilitySummary) {
  const high = Number(vulnerabilitySummary.high || 0);
  const critical = Number(vulnerabilitySummary.critical || 0);

  if (high > 0 || critical > 0) {
    console.error(
      `Dependency audit found ${high} high and ${critical} critical production vulnerabilities.`
    );
    process.exit(1);
  }

  console.log("Dependency audit passed with no high or critical production vulnerabilities.");
  process.exit(0);
}

if (result.status === 0) {
  console.log("Dependency audit passed.");
  process.exit(0);
}

console.error(result.stderr || "Dependency audit failed to run.");
process.exit(result.status ?? 1);
