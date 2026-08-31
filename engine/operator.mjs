import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { readJson, root, writeJson } from "./lib.mjs";

const command = process.argv[2] ?? "status";
const operatorPath = "state/operator.json";

async function loadLocalEnv() {
  for (const filename of [".env.local", ".env"]) {
    const target = path.join(root, filename);
    if (!existsSync(target)) continue;
    for (const line of (await readFile(target, "utf8")).split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
}

function nextBudgetMonth() {
  return new Date().toISOString().slice(0, 7);
}

function normalizeBudget(state) {
  const month = nextBudgetMonth();
  if (state.api.budgetMonth !== month) {
    state.api.budgetMonth = month;
    state.api.estimatedSpendUsd = 0;
    state.publishedThisMonth = 0;
  }
  return state;
}

function statusSummary(state) {
  return {
    lastCycleAt: state.lastCycleAt,
    lastSuccessfulCycleAt: state.lastSuccessfulCycleAt,
    consecutiveFailures: state.consecutiveFailures,
    api: {
      model: state.api.model,
      enabled: state.api.enabled,
      monthlyBudgetUsd: state.api.monthlyBudgetUsd,
      estimatedSpendUsd: state.api.estimatedSpendUsd,
      remainingBudgetUsd: Math.max(0, state.api.monthlyBudgetUsd - state.api.estimatedSpendUsd),
      reason: state.api.reason
    },
    safety: state.safety
  };
}

async function draft() {
  await loadLocalEnv();
  const state = normalizeBudget(await readJson(operatorPath));
  const maxEstimatedDraftCost = 0.05;
  const remaining = state.api.monthlyBudgetUsd - state.api.estimatedSpendUsd;
  if (!state.api.enabled || state.api.monthlyBudgetUsd <= 0) throw new Error("API drafting is disabled because no positive monthly spending cap is authorized.");
  if (remaining < maxEstimatedDraftCost) throw new Error(`Budget guard stopped drafting: $${remaining.toFixed(2)} remains, below the $${maxEstimatedDraftCost.toFixed(2)} per-draft reservation.`);
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is unavailable.");
  const packetPath = path.join(root, "state/research-packet.json");
  if (!existsSync(packetPath)) throw new Error("state/research-packet.json is missing. Research must be supplied before drafting.");
  const packet = JSON.parse(await readFile(packetPath, "utf8"));
  if (!Array.isArray(packet.sources) || packet.sources.filter((source) => source.primary).length < 2) throw new Error("Research packet needs at least two primary sources.");
  const prompt = await readFile(path.join(root, "prompts/operator.md"), "utf8");
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["decision", "reason", "article"],
    properties: {
      decision: { type: "string", enum: ["draft", "hold"] },
      reason: { type: "string" },
      article: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: ["slug", "title", "dek", "description", "pillar", "tags", "published", "updated", "reviewDue", "readingMinutes", "featured", "takeaway", "sections", "sources", "quality"],
            properties: {
              slug: { type: "string" }, title: { type: "string" }, dek: { type: "string" }, description: { type: "string" },
              pillar: { type: "string", enum: ["scam-defense", "account-safety", "safer-defaults"] },
              tags: { type: "array", items: { type: "string" } }, published: { type: "string" }, updated: { type: "string" }, reviewDue: { type: "string" },
              readingMinutes: { type: "integer" }, featured: { type: "boolean" }, takeaway: { type: "array", items: { type: "string" } },
              sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["heading", "paragraphs", "steps", "callout"], properties: { heading: { type: "string" }, paragraphs: { type: "array", items: { type: "string" } }, steps: { anyOf: [{ type: "null" }, { type: "array", items: { type: "string" } }] }, callout: { anyOf: [{ type: "null" }, { type: "string" }] } } } },
              sources: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "publisher", "url", "accessed", "primary"], properties: { title: { type: "string" }, publisher: { type: "string" }, url: { type: "string" }, accessed: { type: "string" }, primary: { type: "boolean" } } } },
              quality: { type: "object", additionalProperties: false, required: ["score", "reviewedBy", "notes"], properties: { score: { type: "integer" }, reviewedBy: { type: "string" }, notes: { type: "string" } } }
            }
          }
        ]
      }
    }
  };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: state.api.model, instructions: prompt, input: JSON.stringify(packet), reasoning: { effort: "medium" }, max_output_tokens: 4500, store: false, text: { format: { type: "json_schema", name: "editorial_candidate", strict: true, schema } } })
  });
  if (!response.ok) throw new Error(`OpenAI request failed with HTTP ${response.status}.`);
  const result = await response.json();
  const outputText = result.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!outputText) throw new Error("OpenAI response contained no structured output text.");
  const candidate = JSON.parse(outputText);
  const usage = result.usage ?? {};
  const estimatedCost = ((usage.input_tokens ?? 0) * 0.75 + (usage.output_tokens ?? 0) * 4.5) / 1_000_000;
  state.api.estimatedSpendUsd = Number((state.api.estimatedSpendUsd + estimatedCost).toFixed(6));
  await writeJson(operatorPath, state);
  await mkdir(path.join(root, "state/drafts"), { recursive: true });
  const draftName = `${new Date().toISOString().replaceAll(":", "-")}-${packet.queueId ?? "candidate"}.json`;
  await writeJson(`state/drafts/${draftName}`, { ...candidate, provenance: { responseId: result.id, model: result.model, researchPacket: "state/research-packet.json", estimatedCostUsd: Number(estimatedCost.toFixed(6)), generatedAt: new Date().toISOString() } });
  await appendFile(path.join(root, "state/runs.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), type: "api-draft", status: candidate.decision, draft: draftName, estimatedCostUsd: Number(estimatedCost.toFixed(6)) })}\n`);
  console.log(JSON.stringify({ decision: candidate.decision, reason: candidate.reason, draft: `state/drafts/${draftName}`, estimatedCostUsd: Number(estimatedCost.toFixed(6)) }, null, 2));
}

const state = normalizeBudget(await readJson(operatorPath));
if (command === "status") {
  await writeJson(operatorPath, state);
  console.log(JSON.stringify(statusSummary(state), null, 2));
} else if (command === "draft") {
  await draft();
} else if (command === "review") {
  console.log("Draft review is deliberately separate from generation. Move an approved article into content/articles/, then run npm run verify.");
} else {
  throw new Error(`Unknown operator command: ${command}`);
}

