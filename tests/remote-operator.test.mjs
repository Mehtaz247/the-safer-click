import test from "node:test";
import assert from "node:assert/strict";
import {
  containsPossibleSecret,
  evaluateBudget,
  extractOutputText,
  isAllowedMutationPath,
  reconcileReservation,
  summarizeUsage,
  validateDecision
} from "../engine/remote-operator-lib.mjs";
import { applyDecision } from "../ops/remote-operator.mjs";
import { access, rm } from "node:fs/promises";
import path from "node:path";
import { root } from "../engine/lib.mjs";

test("remote operator protects its scheduler, kernel, credentials, and spending controls", () => {
  for (const target of [
    ".github/workflows/operator.yml",
    "ops/remote-operator.mjs",
    "engine/remote-operator-lib.mjs",
    "ops/publish.sh",
    "state/operator.json",
    "state/runs.jsonl",
    ".env.local",
    "../outside"
  ]) assert.equal(isAllowedMutationPath(target), false, target);
  for (const target of [
    "content/articles/example.json",
    "state/strategy.json",
    "prompts/remote-operator.md",
    "engine/build.mjs",
    "assets/style.css",
    "tests/example.test.mjs"
  ]) assert.equal(isAllowedMutationPath(target), true, target);
});

test("remote operator budget requires explicit enablement, a positive cap, and a full reservation", () => {
  const base = { api: { enabled: false, monthlyBudgetUsd: 0, estimatedSpendUsd: 0, budgetMonth: "2026-09", maxReservedCostPerCycleUsd: 0.25 } };
  assert.equal(evaluateBudget(base, new Date("2026-09-01T00:00:00Z")).allowed, false);
  const enabled = { api: { ...base.api, enabled: true, monthlyBudgetUsd: 1 } };
  assert.equal(evaluateBudget(enabled, new Date("2026-09-01T00:00:00Z")).allowed, true);
  const exhausted = { api: { ...enabled.api, estimatedSpendUsd: 0.9 } };
  assert.equal(evaluateBudget(exhausted, new Date("2026-09-01T00:00:00Z")).allowed, false);
});

test("GPT-5.6 Terra usage is recorded at approved token prices and replaces the reservation", () => {
  const usage = summarizeUsage("gpt-5.6-terra", {
    input_tokens: 10_000,
    output_tokens: 2_000,
    total_tokens: 12_000,
    input_tokens_details: { cached_tokens: 4_000 }
  });
  assert.deepEqual(usage, {
    inputTokens: 10_000,
    cachedInputTokens: 4_000,
    outputTokens: 2_000,
    totalTokens: 12_000,
    estimatedCostUsd: 0.0368
  });
  const api = reconcileReservation({ estimatedSpendUsd: 1.25 }, 0.25, usage.estimatedCostUsd);
  assert.equal(api.estimatedSpendUsd, 1.0368);
  assert.throws(() => summarizeUsage("unapproved-fallback", {}));
});

test("structured output extraction does not assume the first response item is a message", () => {
  const response = { output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: "{\"operation\":\"hold\"}" }] }] };
  assert.equal(extractOutputText(response), '{"operation":"hold"}');
});

test("decision validation permits bounded writes and rejects secrets", () => {
  const decision = validateDecision({ operation: "code_change", summary: "Improve checks", rationale: "A failing edge case", files: [{ path: "tests/edge.test.mjs", action: "write", content: "test();" }] });
  assert.equal(decision.files[0].path, "tests/edge.test.mjs");
  assert.equal(containsPossibleSecret("OPENAI_API_KEY=$OPENAI_API_KEY"), false);
  assert.equal(containsPossibleSecret("OPENAI_API_KEY=secret-value"), true);
  assert.throws(() => validateDecision({ operation: "code_change", summary: "Bad", rationale: "Bad", files: [{ path: "state/operator.json", action: "write", content: "{}" }] }));
});

test("failed verification rolls back every proposed write", async () => {
  const relative = `tests/.rollback-probe-${process.pid}.txt`;
  const target = path.join(root, relative);
  await rm(target, { force: true });
  const decision = validateDecision({ operation: "code_change", summary: "Probe rollback", rationale: "Test transaction safety", files: [{ path: relative, action: "write", content: "temporary" }] });
  await assert.rejects(() => applyDecision(decision, async () => { throw new Error("intentional verification failure"); }));
  await assert.rejects(() => access(target));
});
