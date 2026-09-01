import path from "node:path";

const exactMutableFiles = new Set([
  "AUTONOMY.md",
  "EDITORIAL_POLICY.md",
  "README.md",
  "SECURITY.md",
  "site.config.json",
  "state/strategy.json",
  "state/queue.json",
  "state/metrics.json",
  "state/experiments.json",
  "state/corrections.json"
]);

const mutablePrefixes = [
  "assets/",
  "content/articles/",
  "engine/",
  "prompts/",
  "tests/"
];

const protectedFiles = new Set([
  "engine/remote-operator-lib.mjs",
  "ops/remote-operator.mjs",
  "ops/publish.sh",
  "state/operator.json",
  "state/runs.jsonl"
]);

export function normalizeRepoPath(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.includes("\0")) return null;
  const normalized = path.posix.normalize(candidate.replaceAll("\\", "/"));
  if (normalized === "." || normalized.startsWith("../") || normalized.startsWith("/") || normalized.includes("/.git/")) return null;
  return normalized;
}

export function isAllowedMutationPath(candidate) {
  const normalized = normalizeRepoPath(candidate);
  if (!normalized || protectedFiles.has(normalized) || normalized.startsWith(".github/")) return false;
  if (exactMutableFiles.has(normalized)) return true;
  return mutablePrefixes.some((prefix) => normalized.startsWith(prefix));
}

export function evaluateBudget(operator, now = new Date()) {
  const month = now.toISOString().slice(0, 7);
  const api = { ...operator.api };
  if (api.budgetMonth !== month) {
    api.budgetMonth = month;
    api.estimatedSpendUsd = 0;
  }
  const reservation = Number(api.maxReservedCostPerCycleUsd ?? 0.25);
  const remaining = Number(api.monthlyBudgetUsd ?? 0) - Number(api.estimatedSpendUsd ?? 0);
  const allowed = Boolean(api.enabled) && api.monthlyBudgetUsd > 0 && reservation > 0 && remaining >= reservation;
  return {
    allowed,
    api,
    reservation,
    remaining: Math.max(0, remaining),
    reason: allowed
      ? "authorized"
      : !api.enabled || api.monthlyBudgetUsd <= 0
        ? "API operation is disabled until a positive monthly budget is explicitly authorized."
        : `The remaining monthly budget is below the $${reservation.toFixed(2)} cycle reservation.`
  };
}

export function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text;
  for (const item of response?.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

export function validateDecision(decision) {
  const operations = new Set(["publish_article", "update_article", "strategy_change", "code_change", "hold"]);
  if (!decision || !operations.has(decision.operation)) throw new Error("The operator returned an unknown operation.");
  if (!Array.isArray(decision.files) || decision.files.length > 8) throw new Error("The operator may return at most eight files.");
  let totalBytes = 0;
  const seen = new Set();
  for (const file of decision.files) {
    const normalized = normalizeRepoPath(file?.path);
    if (!normalized || !isAllowedMutationPath(normalized)) throw new Error(`The operator attempted to change protected path: ${file?.path ?? "<missing>"}`);
    if (seen.has(normalized)) throw new Error(`The operator returned duplicate path: ${normalized}`);
    if (file.action !== "write" || typeof file.content !== "string") throw new Error(`Unsupported mutation for ${normalized}. Only complete-file writes are allowed.`);
    totalBytes += Buffer.byteLength(file.content);
    seen.add(normalized);
  }
  if (totalBytes > 250_000) throw new Error("The proposed change exceeds the 250 KB cycle limit.");
  if (decision.operation === "hold" && decision.files.length) throw new Error("A hold decision cannot modify files.");
  if (decision.operation !== "hold" && decision.files.length === 0) throw new Error("A change decision must include at least one file.");
  return { ...decision, files: decision.files.map((file) => ({ ...file, path: normalizeRepoPath(file.path) })) };
}

export function containsPossibleSecret(value) {
  return /(?:sk|rk)-[A-Za-z0-9_-]{20,}/.test(value) || /OPENAI_API_KEY\s*=\s*[^\s$]/.test(value);
}

export function isPrimarySourceUrl(candidate) {
  try {
    const hostname = new URL(candidate).hostname.toLowerCase();
    return hostname.endsWith(".gov") || hostname.endsWith(".gov.uk") || hostname.endsWith(".europa.eu") || hostname.endsWith(".int") || [
      "support.apple.com",
      "support.google.com",
      "support.microsoft.com",
      "www.ncsc.gov.uk"
    ].includes(hostname);
  } catch {
    return false;
  }
}
