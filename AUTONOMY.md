# Autonomous operating loop

The operator owns routine topic selection, research, drafting, editing, design, publication, correction, measurement, and strategy decisions. Persistent state lives in `state/`; published truth lives in `content/articles/`; generated output lives in `docs/`.

## Each editorial cycle

1. Read `state/strategy.json`, `state/queue.json`, the latest entries in `state/runs.jsonl`, open experiments, corrections, and any verified metrics.
2. Check overdue article reviews before creating new work.
3. Research the highest-priority viable queue item with current primary sources. Never use model memory as article evidence.
4. Draft or update one useful guide. If evidence is weak, record a hold and choose another item.
5. Run `npm run cycle`; repair every failure before publication.
6. If source code, prompts, workflows, or design changed, preserve the current deployed commit with a `safety-backup/<UTC timestamp>` tag before committing the change.
7. Commit and push through `ops/publish.sh`. Verify the public route after GitHub Pages finishes deploying.
8. Record what happened in `state/runs.jsonl`, update queue state and honest metrics, and note the next concrete action.

## Remote execution

The `Autonomous operator` GitHub Actions workflow is the durable trigger. It runs on GitHub-hosted infrastructure every day, so normal operation does not depend on a local computer and a delayed scheduler event has another chance the next day. Editorial cadence remains governed by strategy rather than trigger frequency. The workflow always runs deterministic verification. Model-backed editorial decisions run only when `state/operator.json` contains an explicitly authorized positive monthly budget and enabled API gate.

The remote operator may update articles, strategy, queue, metrics, experiments, prompts, design assets, tests, and ordinary engine modules. A small safety kernel, the workflow definition, credentials, run history, publishing script, and spending controls are protected from direct model writes. This preserves a reliable next run even when mutable operator code changes.

When a remote cycle makes a verified change, it creates and pushes a `safety-backup/<UTC timestamp>` tag, commits the result, deploys the built artifact in the same workflow, and checks the public home page, feed, and sitemap. Deployment happens in the same workflow because pushes authenticated with GitHub's standard Actions token do not trigger another workflow.

## Adaptation rhythm

- Every cycle: source freshness, build health, queue priority, and public-route verification.
- Weekly: indexation and search queries when verified data exists; broken links; article mix across pillars.
- Every four weeks: active experiment decision, topic-cluster performance, corrections, and whether cadence is sustainable.
- Quarterly: positioning review. Change the niche only with evidence, not boredom.

## Cost boundary

`state/operator.json` is the authoritative API spending gate. API operation must remain disabled and its monthly budget at zero until a positive cap is explicitly authorized. A saved key is capability, not spending permission. The remote operator reserves the configured maximum cycle cost before any model call and stops when a complete reservation no longer fits within the monthly cap. Research discovery uses direct public-web requests without sending the API key to a search service.

## Recovery boundary

Published articles are never auto-deleted. A weak or stale page is updated, marked for review, or redirected. Self-modifying changes require a recoverable tag and a clean verification run. If a change breaks the operator, restore the last `safety-backup/*` tag in a new branch and diagnose the failure without destroying later commits.
