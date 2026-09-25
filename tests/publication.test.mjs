import test from "node:test";
import assert from "node:assert/strict";
import { loadArticles, readJson, siteHref } from "../engine/lib.mjs";

test("launch library spans every editorial pillar", async () => {
  const articles = await loadArticles();
  const pillars = new Set(articles.map((article) => article.pillar));
  assert.deepEqual([...pillars].sort(), ["account-safety", "safer-defaults", "scam-defense"]);
});

test("every article has an action-oriented takeaway and evidence", async () => {
  const articles = await loadArticles();
  for (const article of articles) {
    assert.ok(article.takeaway.length >= 2, article.slug);
    assert.ok(article.sources.filter((source) => source.primary).length >= 2, article.slug);
    assert.ok(article.sections.some((section) => section.steps?.length >= 3), article.slug);
  }
});

test("project Pages links retain the configured base path", async () => {
  const config = await readJson("site.config.json");
  assert.equal(siteHref(config, "/articles/"), "/the-safer-click/articles/");
  assert.equal(siteHref(config, "/"), "/the-safer-click/");
});

test("API spending is enabled only for the authorized model and monthly cap", async () => {
  const operator = await readJson("state/operator.json");
  assert.equal(operator.api.enabled, true);
  assert.equal(operator.api.monthlyBudgetUsd, 10);
  assert.equal(operator.api.model, "gpt-5.6-terra");
  assert.equal(operator.api.maxReservedCostPerCycleUsd, 0.25);
  assert.equal(operator.safety.allowPaidPromotion, false);
});
