import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", "node_modules", "dist", "coverage"]);
const scannedExtensions = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".env",
  ".txt",
  ".css",
  ".html"
]);

const patterns = [
  { label: "Private key", regex: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/ },
  { label: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { label: "OpenAI key", regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { label: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "Google API key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { label: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/ }
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
      continue;
    }

    const extension = path.extname(entry.name);
    const isEnvFile = entry.name.startsWith(".env");

    if (isEnvFile || scannedExtensions.has(extension)) {
      files.push(absolutePath);
    }
  }

  return files;
}

const files = await collectFiles(root);
const findings = [];

for (const file of files) {
  const content = await readFile(file, "utf8");

  for (const pattern of patterns) {
    const match = content.match(pattern.regex);

    if (match) {
      findings.push({
        file: path.relative(root, file),
        label: pattern.label,
        sample: match[0].slice(0, 24)
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secrets detected:");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.label} (${finding.sample}...)`);
  }
  process.exit(1);
}

console.log(`Secret hygiene check passed across ${files.length} files.`);
