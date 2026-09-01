import test from "node:test";
import assert from "node:assert/strict";
import {
  containsPossibleSecret,
  evaluateBudget,
  extractOutputText,
  isAllowedMutationPath,
  validateDecision
} from "../engine/remote-operator-lib.mjs";

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
